const { executeQuery } = require('./config/database');

(async () => {
  try {
    // Find UPDATED activities that happened at same time as STATUS_CHANGED (within 2 seconds)
    const r = await executeQuery(`
      SELECT u.activity_id, u.ticket_id, u.field_name, u.description, u.performed_at
      FROM ticket_activities u
      WHERE u.activity_type = 'UPDATED'
        AND EXISTS (
          SELECT 1 FROM ticket_activities s
          WHERE s.ticket_id = u.ticket_id
            AND s.activity_type = 'STATUS_CHANGED'
            AND ABS(DATEDIFF(SECOND, s.performed_at, u.performed_at)) <= 2
        )
      ORDER BY u.performed_at DESC
    `);

    console.log('UPDATED activities alongside STATUS_CHANGED:', r.recordset.length);
    r.recordset.forEach(a => {
      console.log(`  ID:${a.activity_id} ticket:${a.ticket_id} field:${a.field_name} - ${a.description}`);
    });

    if (r.recordset.length > 0) {
      const ids = r.recordset.map(a => a.activity_id);
      await executeQuery(`DELETE FROM ticket_activities WHERE activity_id IN (${ids.join(',')})`);
      console.log(`Deleted ${ids.length} redundant activities.`);
    } else {
      console.log('No cleanup needed.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
