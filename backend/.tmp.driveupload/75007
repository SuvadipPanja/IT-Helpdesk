// ============================================
// SLA SERVICE
// Core Service Level Agreement calculation engine
// Handles business hours, working days, SLA tracking
// Developed by: Suvadip Panja
// Date: November 01, 2025
// FILE: backend/services/sla.service.js
// ============================================

const { executeQuery } = require('../config/database');
const settingsService = require('./settings.service');
const logger = require('../utils/logger');

class SLAService {
  constructor() {
    this.settings = null;
    this.settingsLoadedAt = null;
    this.settingsCacheDuration = 5 * 60 * 1000; // 5 minutes cache
  }

  // ============================================
  // LOAD SLA SETTINGS FROM DATABASE
  // Cache settings for 5 minutes to reduce DB calls
  // ============================================
  async loadSettings() {
    try {
      const now = Date.now();
      
      // Return cached settings if still valid
      if (this.settings && this.settingsLoadedAt && 
          (now - this.settingsLoadedAt) < this.settingsCacheDuration) {
        return this.settings;
      }

      logger.info('🔄 Loading SLA settings from database...');
      
      const slaSettings = await settingsService.getByCategory('sla');
      
      this.settings = {
        enabled: slaSettings.sla_enabled === 'true' || slaSettings.sla_enabled === true,
        businessHoursStart: slaSettings.sla_business_hours_start || '09:00',
        businessHoursEnd: slaSettings.sla_business_hours_end || '17:00',
        workingDays: (slaSettings.sla_working_days || 'mon,tue,wed,thu,fri').split(','),
        warningThreshold: parseInt(slaSettings.sla_warning_threshold) || 80,
        breachNotifyManager: slaSettings.sla_breach_notify_manager === 'true',
        breachAutoEscalate: slaSettings.sla_breach_auto_escalate === 'true'
      };
      
      this.settingsLoadedAt = now;
      
      logger.success('✅ SLA settings loaded successfully', {
        enabled: this.settings.enabled,
        businessHours: `${this.settings.businessHoursStart} - ${this.settings.businessHoursEnd}`,
        workingDays: this.settings.workingDays.join(','),
        warningThreshold: `${this.settings.warningThreshold}%`
      });
      
      return this.settings;
      
    } catch (error) {
      logger.error('❌ Failed to load SLA settings, using defaults', error);
      
      // Return safe defaults
      this.settings = {
        enabled: true,
        businessHoursStart: '09:00',
        businessHoursEnd: '17:00',
        workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        warningThreshold: 80,
        breachNotifyManager: true,
        breachAutoEscalate: false
      };
      
      return this.settings;
    }
  }

  // ============================================
  // CHECK IF SLA TRACKING IS ENABLED
  // ============================================
  async isEnabled() {
    const settings = await this.loadSettings();
    return settings.enabled;
  }

  // ============================================
  // PARSE TIME STRING (HH:MM) TO HOURS
  // Example: "09:30" -> 9.5
  // ============================================
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + (minutes / 60);
  }

  // ============================================
  // CHECK IF DATE IS A WORKING DAY
  // ============================================
  async isWorkingDay(date) {
    try {
      const settings = await this.loadSettings();
      
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayName = dayNames[date.getDay()];
      
      return settings.workingDays.includes(dayName);
      
    } catch (error) {
      logger.error('Error checking working day', error);
      // Default to Monday-Friday
      const day = date.getDay();
      return day >= 1 && day <= 5;
    }
  }

  // ============================================
  // CHECK IF TIME IS WITHIN BUSINESS HOURS
  // ============================================
  async isWithinBusinessHours(date) {
    try {
      const settings = await this.loadSettings();
      
      const currentHour = date.getHours() + (date.getMinutes() / 60);
      const startHour = this.parseTime(settings.businessHoursStart);
      const endHour = this.parseTime(settings.businessHoursEnd);
      
      return currentHour >= startHour && currentHour < endHour;
      
    } catch (error) {
      logger.error('Error checking business hours', error);
      // Default to 9 AM - 5 PM
      const hour = date.getHours();
      return hour >= 9 && hour < 17;
    }
  }

  // ============================================
  // GET BUSINESS HOURS PER DAY
  // Example: 09:00 - 17:00 = 8 hours
  // ============================================
  async getBusinessHoursPerDay() {
    try {
      const settings = await this.loadSettings();
      
      const startHour = this.parseTime(settings.businessHoursStart);
      const endHour = this.parseTime(settings.businessHoursEnd);
      
      return endHour - startHour;
      
    } catch (error) {
      logger.error('Error getting business hours per day', error);
      return 8; // Default 8 hours
    }
  }

  // ============================================
  // MOVE DATE TO START OF NEXT BUSINESS DAY
  // ============================================
  async moveToNextBusinessDay(date) {
    try {
      const settings = await this.loadSettings();
      const newDate = new Date(date);
      
      // Move to next day
      newDate.setDate(newDate.getDate() + 1);
      
      // Set to start of business hours
      const [hours, minutes] = settings.businessHoursStart.split(':').map(Number);
      newDate.setHours(hours, minutes, 0, 0);
      
      // Keep moving until we hit a working day
      while (!(await this.isWorkingDay(newDate))) {
        newDate.setDate(newDate.getDate() + 1);
      }
      
      return newDate;
      
    } catch (error) {
      logger.error('Error moving to next business day', error);
      const newDate = new Date(date);
      newDate.setDate(newDate.getDate() + 1);
      newDate.setHours(9, 0, 0, 0);
      return newDate;
    }
  }

  // ============================================
  // CALCULATE SLA DUE DATE
  // Main function: Adds business hours to start date
  // Skips nights, weekends, and non-working days
  // ============================================
  async calculateDueDate(startDate, slaHours) {
    try {
      logger.info('📅 Calculating SLA due date', {
        startDate: startDate.toISOString(),
        slaHours,
        timezone: 'IST'
      });

      const settings = await this.loadSettings();
      
      // If SLA tracking disabled, return simple calculation
      if (!settings.enabled) {
        const simpleDate = new Date(startDate);
        simpleDate.setHours(simpleDate.getHours() + slaHours);
        logger.info('⚠️ SLA tracking disabled, using simple calculation');
        return simpleDate;
      }

      let currentDate = new Date(startDate);
      let remainingHours = slaHours;
      
      const startHour = this.parseTime(settings.businessHoursStart);
      const endHour = this.parseTime(settings.businessHoursEnd);
      const hoursPerDay = endHour - startHour;

      logger.info('🔧 SLA Calculation Parameters', {
        businessHours: `${settings.businessHoursStart} - ${settings.businessHoursEnd}`,
        hoursPerDay: hoursPerDay,
        workingDays: settings.workingDays.join(',')
      });

      // Safety counter to prevent infinite loops
      let iterations = 0;
      const maxIterations = 365; // Max 1 year

      while (remainingHours > 0 && iterations < maxIterations) {
        iterations++;

        // Check if current date is a working day
        if (!(await this.isWorkingDay(currentDate))) {
          logger.debug(`⏭️ Skipping non-working day: ${currentDate.toDateString()}`);
          currentDate = await this.moveToNextBusinessDay(currentDate);
          continue;
        }

        const currentHour = currentDate.getHours() + (currentDate.getMinutes() / 60);

        // If before business hours, move to start
        if (currentHour < startHour) {
          logger.debug(`⏰ Before business hours, moving to ${settings.businessHoursStart}`);
          const [hours, minutes] = settings.businessHoursStart.split(':').map(Number);
          currentDate.setHours(hours, minutes, 0, 0);
          continue;
        }

        // If after business hours, move to next business day
        if (currentHour >= endHour) {
          logger.debug(`🌙 After business hours, moving to next business day`);
          currentDate = await this.moveToNextBusinessDay(currentDate);
          continue;
        }

        // Calculate available hours remaining today
        const hoursLeftToday = endHour - currentHour;

        if (remainingHours <= hoursLeftToday) {
          // Can complete today
          const hoursToAdd = Math.floor(remainingHours);
          const minutesToAdd = Math.round((remainingHours - hoursToAdd) * 60);
          
          currentDate.setHours(currentDate.getHours() + hoursToAdd);
          currentDate.setMinutes(currentDate.getMinutes() + minutesToAdd);
          
          logger.success('✅ SLA due date calculated', {
            dueDate: currentDate.toISOString(),
            totalBusinessHours: slaHours,
            iterations
          });
          
          remainingHours = 0;
        } else {
          // Need to continue on next day
          remainingHours -= hoursLeftToday;
          logger.debug(`📊 Used ${hoursLeftToday}h today, ${remainingHours}h remaining`);
          currentDate = await this.moveToNextBusinessDay(currentDate);
        }
      }

      if (iterations >= maxIterations) {
        logger.error('⚠️ Max iterations reached in SLA calculation!');
        // Fallback to simple calculation
        const fallbackDate = new Date(startDate);
        fallbackDate.setHours(fallbackDate.getHours() + slaHours);
        return fallbackDate;
      }

      return currentDate;

    } catch (error) {
      logger.error('❌ Error calculating SLA due date', error);
      
      // Fallback to simple calculation
      const fallbackDate = new Date(startDate);
      fallbackDate.setHours(fallbackDate.getHours() + slaHours);
      return fallbackDate;
    }
  }

  // ============================================
  // CALCULATE BUSINESS HOURS ELAPSED
  // Between two dates (considering business hours only)
  // ============================================
  async calculateBusinessHoursElapsed(startDate, endDate) {
    try {
      const settings = await this.loadSettings();
      
      if (!settings.enabled) {
        // Simple hour difference
        const diffMs = endDate - startDate;
        return Math.floor(diffMs / (1000 * 60 * 60));
      }

      let currentDate = new Date(startDate);
      const finalDate = new Date(endDate);
      let totalHours = 0;

      const startHour = this.parseTime(settings.businessHoursStart);
      const endHour = this.parseTime(settings.businessHoursEnd);

      // Safety counter
      let iterations = 0;
      const maxIterations = 365;

      while (currentDate < finalDate && iterations < maxIterations) {
        iterations++;

        // Check if working day
        if (await this.isWorkingDay(currentDate)) {
          const currentHour = currentDate.getHours() + (currentDate.getMinutes() / 60);
          
          // Only count if within business hours
          if (currentHour >= startHour && currentHour < endHour) {
            // Calculate hours for this day
            const dayStart = Math.max(currentHour, startHour);
            const dayEnd = Math.min(
              finalDate.getDate() === currentDate.getDate() ?
                finalDate.getHours() + (finalDate.getMinutes() / 60) :
                endHour,
              endHour
            );
            
            if (dayEnd > dayStart) {
              totalHours += (dayEnd - dayStart);
            }
          }
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(
          ...settings.businessHoursStart.split(':').map(Number),
          0,
          0
        );
      }

      return totalHours;

    } catch (error) {
      logger.error('Error calculating business hours elapsed', error);
      const diffMs = endDate - startDate;
      return Math.floor(diffMs / (1000 * 60 * 60));
    }
  }

  // ============================================
  // CHECK SLA STATUS
  // Returns: ON_TRACK, WARNING, BREACHED
  // ============================================
  async checkSLAStatus(ticket) {
    try {
      const now = new Date();
      const dueDate = new Date(ticket.due_date);
      const createdAt = new Date(ticket.created_at);

      // If ticket is closed, check if SLA was met
      if (ticket.is_final_status) {
        const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : now;
        return resolvedAt <= dueDate ? 'MET' : 'BREACHED';
      }

      // If past due date, it's breached
      if (now > dueDate) {
        const hoursBreached = await this.calculateBusinessHoursElapsed(dueDate, now);
        
        return {
          status: 'BREACHED',
          hoursBreached: Math.round(hoursBreached * 10) / 10,
          dueDate: dueDate.toISOString(),
          now: now.toISOString()
        };
      }

      // Calculate percentage of SLA time used
      const settings = await this.loadSettings();
      const totalSLATime = await this.calculateBusinessHoursElapsed(createdAt, dueDate);
      const elapsedTime = await this.calculateBusinessHoursElapsed(createdAt, now);
      const percentageUsed = (elapsedTime / totalSLATime) * 100;

      logger.debug('📊 SLA Status Check', {
        ticketNumber: ticket.ticket_number,
        totalSLATime: Math.round(totalSLATime * 10) / 10,
        elapsedTime: Math.round(elapsedTime * 10) / 10,
        percentageUsed: Math.round(percentageUsed),
        warningThreshold: settings.warningThreshold
      });

      // Check if at warning threshold
      if (percentageUsed >= settings.warningThreshold) {
        const remainingHours = totalSLATime - elapsedTime;
        
        return {
          status: 'WARNING',
          percentageUsed: Math.round(percentageUsed),
          remainingHours: Math.round(remainingHours * 10) / 10,
          dueDate: dueDate.toISOString()
        };
      }

      // On track
      const remainingHours = totalSLATime - elapsedTime;
      
      return {
        status: 'ON_TRACK',
        percentageUsed: Math.round(percentageUsed),
        remainingHours: Math.round(remainingHours * 10) / 10,
        dueDate: dueDate.toISOString()
      };

    } catch (error) {
      logger.error('Error checking SLA status', error);
      return {
        status: 'UNKNOWN',
        error: error.message
      };
    }
  }

  // ============================================
  // GET SLA TIME REMAINING (Formatted)
  // Returns human-readable time like "2h 30m"
  // ============================================
  async getTimeRemaining(ticket) {
    try {
      const now = new Date();
      const dueDate = new Date(ticket.due_date);

      if (now > dueDate) {
        // Breached - return negative time
        const hoursBreached = await this.calculateBusinessHoursElapsed(dueDate, now);
        return this.formatDuration(hoursBreached, true);
      }

      // Calculate remaining business hours
      const remainingHours = await this.calculateBusinessHoursElapsed(now, dueDate);
      return this.formatDuration(remainingHours, false);

    } catch (error) {
      logger.error('Error getting time remaining', error);
      return 'Unknown';
    }
  }

  // ============================================
  // FORMAT DURATION (Hours to Human Readable)
  // Examples: "2h 30m", "1d 3h", "45m"
  // ============================================
  formatDuration(hours, isNegative = false) {
    try {
      const absHours = Math.abs(hours);
      
      const days = Math.floor(absHours / 24);
      const remainingHours = Math.floor(absHours % 24);
      const minutes = Math.round((absHours % 1) * 60);

      const parts = [];
      
      if (days > 0) parts.push(`${days}d`);
      if (remainingHours > 0) parts.push(`${remainingHours}h`);
      if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
      
      if (parts.length === 0) {
        return isNegative ? 'Breached (just now)' : 'Due now';
      }

      const formatted = parts.join(' ');
      return isNegative ? `${formatted} ago` : formatted;

    } catch (error) {
      logger.error('Error formatting duration', error);
      return 'Unknown';
    }
  }

  // ============================================
  // UPDATE TICKET SLA FIELDS
  // Called when ticket status changes
  // ============================================
  async updateTicketSLA(ticketId) {
    try {
      logger.info('🔄 Updating ticket SLA fields', { ticketId });

      // Get ticket details
      const ticketQuery = `
        SELECT 
          t.ticket_id,
          t.ticket_number,
          t.created_at,
          t.due_date,
          t.first_response_at,
          t.resolved_at,
          t.status_id,
          ts.is_final_status,
          tp.response_time_hours,
          tp.resolution_time_hours
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        WHERE t.ticket_id = @ticketId
      `;

      const result = await executeQuery(ticketQuery, { ticketId });
      
      if (result.recordset.length === 0) {
        logger.warn('Ticket not found for SLA update', { ticketId });
        return;
      }

      const ticket = result.recordset[0];

      // Calculate first response SLA
      let firstResponseSLAMet = null;
      if (ticket.first_response_at && ticket.response_time_hours) {
        const responseDate = new Date(ticket.first_response_at);
        const responseDueDate = await this.calculateDueDate(
          new Date(ticket.created_at),
          ticket.response_time_hours
        );
        firstResponseSLAMet = responseDate <= responseDueDate;
      }

      // Calculate resolution SLA
      let resolutionSLAMet = null;
      if (ticket.is_final_status && ticket.resolved_at) {
        const resolvedDate = new Date(ticket.resolved_at);
        const dueDate = new Date(ticket.due_date);
        resolutionSLAMet = resolvedDate <= dueDate;
      }

      // Update database
      const updateQuery = `
        UPDATE tickets
        SET 
          first_response_sla_met = @firstResponseSLAMet,
          resolution_sla_met = @resolutionSLAMet
        WHERE ticket_id = @ticketId
      `;

      await executeQuery(updateQuery, {
        ticketId,
        firstResponseSLAMet,
        resolutionSLAMet
      });

      logger.success('✅ Ticket SLA fields updated', {
        ticketNumber: ticket.ticket_number,
        firstResponseSLAMet,
        resolutionSLAMet
      });

    } catch (error) {
      logger.error('❌ Error updating ticket SLA', error);
    }
  }

  // ============================================
  // GET SLA METRICS (For Dashboard/Analytics)
  // ============================================
  async getSLAMetrics(filters = {}) {
    try {
      logger.info('📊 Fetching SLA metrics', filters);

      const { start_date, end_date } = filters;
      
      const dateFilter = start_date && end_date 
        ? `AND t.created_at BETWEEN '${start_date}' AND '${end_date}'`
        : '';

      const query = `
        SELECT 
          -- Total tickets
          COUNT(*) as total_tickets,
          
          -- First response SLA
          SUM(CASE WHEN t.first_response_sla_met = 1 THEN 1 ELSE 0 END) as first_response_met,
          SUM(CASE WHEN t.first_response_sla_met = 0 THEN 1 ELSE 0 END) as first_response_breached,
          
          -- Resolution SLA
          SUM(CASE WHEN t.resolution_sla_met = 1 THEN 1 ELSE 0 END) as resolution_met,
          SUM(CASE WHEN t.resolution_sla_met = 0 THEN 1 ELSE 0 END) as resolution_breached,
          
          -- Overall compliance
          CASE 
            WHEN COUNT(*) > 0 
            THEN CAST(SUM(CASE WHEN t.resolution_sla_met = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100
            ELSE 0
          END as compliance_percentage,
          
          -- Average resolution time (hours)
          AVG(
            CASE 
              WHEN t.resolved_at IS NOT NULL
              THEN DATEDIFF(HOUR, t.created_at, t.resolved_at)
              ELSE NULL
            END
          ) as avg_resolution_hours
          
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 1
          ${dateFilter}
      `;

      const result = await executeQuery(query);
      const metrics = result.recordset[0];

      logger.success('✅ SLA metrics fetched', {
        totalTickets: metrics.total_tickets,
        compliance: `${Math.round(metrics.compliance_percentage)}%`
      });

      return {
        totalTickets: metrics.total_tickets || 0,
        firstResponse: {
          met: metrics.first_response_met || 0,
          breached: metrics.first_response_breached || 0
        },
        resolution: {
          met: metrics.resolution_met || 0,
          breached: metrics.resolution_breached || 0
        },
        compliance: Math.round(metrics.compliance_percentage || 0),
        avgResolutionHours: Math.round((metrics.avg_resolution_hours || 0) * 10) / 10
      };

    } catch (error) {
      logger.error('❌ Error fetching SLA metrics', error);
      return {
        totalTickets: 0,
        firstResponse: { met: 0, breached: 0 },
        resolution: { met: 0, breached: 0 },
        compliance: 0,
        avgResolutionHours: 0
      };
    }
  }

  // ============================================
  // REFRESH SETTINGS CACHE
  // Call this after settings are updated
  // ============================================
  refreshCache() {
    this.settings = null;
    this.settingsLoadedAt = null;
    logger.info('🔄 SLA settings cache refreshed');
  }
}

// Export singleton instance
module.exports = new SLAService();