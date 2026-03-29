// ============================================
// SLA POLICIES CONTROLLER
// CRUD for per-category × per-priority SLA thresholds.
//
// Fallback chain for SLA hours resolution:
//   1. sla_policies WHERE category_id = X  AND priority_id = Y  (specific)
//   2. sla_policies WHERE category_id IS NULL AND priority_id = Y (default)
//   3. ticket_priorities.resolution_time_hours (legacy)
//
// Developer: Suvadip Panja
// Date: March 2026
// FILE: backend/controllers/sla.controller.js
// ============================================

const { executeQuery } = require('../config/database');
const slaService = require('../services/sla.service');
const logger = require('../utils/logger');

// ============================================
// GET ALL SLA POLICIES
// Returns flat list of all rows in sla_policies
// plus the categories and priorities for matrix rendering.
// ============================================
async function getPolicies(req, res) {
  try {
    // Fetch all policies
    const policiesResult = await executeQuery(`
      SELECT
        sp.policy_id,
        sp.category_id,
        sp.priority_id,
        sp.response_time_hours,
        sp.resolution_time_hours,
        sp.is_active,
        sp.notes,
        sp.updated_at,
        tc.category_name,
        tp.priority_name,
        tp.priority_code,
        tp.priority_level
      FROM sla_policies sp
      INNER JOIN ticket_priorities tp ON tp.priority_id = sp.priority_id
      LEFT JOIN ticket_categories tc ON tc.category_id = sp.category_id
      WHERE sp.is_active = 1
      ORDER BY tp.priority_level ASC, tc.category_name ASC
    `);

    // Fetch categories (for matrix columns)
    const categoriesResult = await executeQuery(`
      SELECT category_id, category_name
      FROM ticket_categories
      WHERE ISNULL(is_active, 1) = 1
      ORDER BY category_name ASC
    `);

    // Fetch priorities (for matrix rows)
    const prioritiesResult = await executeQuery(`
      SELECT priority_id, priority_name, priority_code, priority_level,
             response_time_hours, resolution_time_hours
      FROM ticket_priorities
      WHERE ISNULL(is_active, 1) = 1
      ORDER BY priority_level ASC
    `);

    return res.json({
      success: true,
      data: {
        policies: policiesResult.recordset,
        categories: categoriesResult.recordset,
        priorities: prioritiesResult.recordset
      }
    });

  } catch (error) {
    logger.error('❌ getPolicies error', error);
    return res.status(500).json({ success: false, message: 'Failed to load SLA policies' });
  }
}

// ============================================
// BULK UPSERT SLA POLICIES
// Accepts an array of policy objects.
// Each object: { category_id (null for default), priority_id,
//               response_time_hours, resolution_time_hours }
// Uses MERGE to upsert deterministically.
// ============================================
async function bulkUpsertPolicies(req, res) {
  try {
    const { policies } = req.body;

    if (!Array.isArray(policies) || policies.length === 0) {
      return res.status(400).json({ success: false, message: 'policies array is required' });
    }

    // Validate each entry
    for (const p of policies) {
      if (!p.priority_id) {
        return res.status(400).json({ success: false, message: 'Each policy must have priority_id' });
      }
      if (p.response_time_hours != null && (isNaN(p.response_time_hours) || p.response_time_hours <= 0)) {
        return res.status(400).json({ success: false, message: 'response_time_hours must be a positive number' });
      }
      if (p.resolution_time_hours != null && (isNaN(p.resolution_time_hours) || p.resolution_time_hours <= 0)) {
        return res.status(400).json({ success: false, message: 'resolution_time_hours must be a positive number' });
      }
    }

    let upsertedCount = 0;

    for (const p of policies) {
      const categoryId = (p.category_id === null || p.category_id === undefined || p.category_id === '')
        ? null
        : parseInt(p.category_id, 10);
      const priorityId = parseInt(p.priority_id, 10);
      const responseHours = parseFloat(p.response_time_hours) || 4;
      const resolutionHours = parseFloat(p.resolution_time_hours) || 24;

      if (categoryId === null) {
        // Use WHERE category_id IS NULL path
        await executeQuery(`
          IF EXISTS (
            SELECT 1 FROM sla_policies
            WHERE category_id IS NULL AND priority_id = @priorityId
          )
          BEGIN
            UPDATE sla_policies
            SET response_time_hours   = @responseHours,
                resolution_time_hours = @resolutionHours,
                updated_at            = GETDATE()
            WHERE category_id IS NULL AND priority_id = @priorityId
          END
          ELSE
          BEGIN
            INSERT INTO sla_policies
              (category_id, priority_id, response_time_hours, resolution_time_hours, is_active)
            VALUES
              (NULL, @priorityId, @responseHours, @resolutionHours, 1)
          END
        `, { priorityId, responseHours, resolutionHours });
      } else {
        // Use WHERE category_id = @categoryId path
        await executeQuery(`
          IF EXISTS (
            SELECT 1 FROM sla_policies
            WHERE category_id = @categoryId AND priority_id = @priorityId
          )
          BEGIN
            UPDATE sla_policies
            SET response_time_hours   = @responseHours,
                resolution_time_hours = @resolutionHours,
                updated_at            = GETDATE()
            WHERE category_id = @categoryId AND priority_id = @priorityId
          END
          ELSE
          BEGIN
            INSERT INTO sla_policies
              (category_id, priority_id, response_time_hours, resolution_time_hours, is_active)
            VALUES
              (@categoryId, @priorityId, @responseHours, @resolutionHours, 1)
          END
        `, { categoryId, priorityId, responseHours, resolutionHours });
      }

      upsertedCount++;
    }

    // Invalidate the in-memory policy cache so next ticket creation picks up new values
    slaService.invalidatePolicyCache();

    logger.success(`✅ bulkUpsertPolicies: upserted ${upsertedCount} policies`);

    return res.json({
      success: true,
      message: `${upsertedCount} SLA policies saved successfully`,
      upsertedCount
    });

  } catch (error) {
    logger.error('❌ bulkUpsertPolicies error', error);
    return res.status(500).json({ success: false, message: 'Failed to save SLA policies' });
  }
}

// ============================================
// RECALCULATE DUE DATES FOR ALL OPEN TICKETS
// Re-applies current SLA policies to recalculate
// due_date for every non-final, non-paused ticket.
// Only updates tickets whose computed due date
// differs from the stored one.
// ============================================
async function recalculateOpenTickets(req, res) {
  try {
    logger.info('🔄 recalculateOpenTickets: starting...');

    // Invalidate cache so fresh policies are used
    slaService.invalidatePolicyCache();

    const openTickets = await executeQuery(`
      SELECT
        t.ticket_id,
        t.ticket_number,
        t.created_at,
        t.category_id,
        t.priority_id,
        t.due_date
      FROM tickets t
      INNER JOIN ticket_statuses ts ON ts.status_id = t.status_id
      WHERE ts.is_final_status = 0
        AND ISNULL(t.sla_paused, 0) = 0
    `);

    const tickets = openTickets.recordset;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const ticket of tickets) {
      try {
        const slaHours = await slaService.getSLAPolicyHours(ticket.category_id, ticket.priority_id);
        if (!slaHours) { skippedCount++; continue; }

        const newDueDate = await slaService.calculateDueDate(new Date(ticket.created_at), slaHours);
        if (!newDueDate) { skippedCount++; continue; }

        const existing = ticket.due_date ? new Date(ticket.due_date).getTime() : null;
        const computed = newDueDate.getTime();

        // Only update if the due date actually changes (>1 minute difference)
        if (!existing || Math.abs(computed - existing) > 60000) {
          await executeQuery(`
            UPDATE tickets
            SET due_date = @newDueDate
            WHERE ticket_id = @ticketId
          `, { newDueDate, ticketId: ticket.ticket_id });
          updatedCount++;
          logger.info(`  Updated ${ticket.ticket_number}: ${newDueDate.toISOString()}`);
        } else {
          skippedCount++;
        }
      } catch (inner) {
        logger.warn(`  Could not recalculate ${ticket.ticket_number}: ${inner.message}`);
        skippedCount++;
      }
    }

    logger.success(`✅ recalculateOpenTickets: updated ${updatedCount}, skipped ${skippedCount}`);

    return res.json({
      success: true,
      message: `Recalculation complete: ${updatedCount} updated, ${skippedCount} skipped`,
      updatedCount,
      skippedCount,
      total: tickets.length
    });

  } catch (error) {
    logger.error('❌ recalculateOpenTickets error', error);
    return res.status(500).json({ success: false, message: 'Failed to recalculate SLA due dates' });
  }
}

module.exports = {
  getPolicies,
  bulkUpsertPolicies,
  recalculateOpenTickets
};
