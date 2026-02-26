const { executeQuery } = require('./config/database');

(async () => {
  try {
    // Check raw settings from DB
    const r = await executeQuery(`
      SELECT setting_key, setting_value, setting_type, setting_category
      FROM system_settings 
      WHERE setting_key LIKE '%auto%' OR setting_key LIKE '%assign%' OR setting_key LIKE '%ticket_%'
      ORDER BY setting_category, setting_key
    `);
    console.log('=== Raw DB Settings ===');
    r.recordset.forEach(s => 
      console.log(`  [${s.setting_category}] ${s.setting_key} = "${s.setting_value}" (type: ${s.setting_type})`)
    );

    // Check via settings service
    const settingsService = require('./services/settings.service');
    const ticketSettings = await settingsService.getByCategory('ticket');
    console.log('\n=== settingsService.getByCategory("ticket") ===');
    Object.entries(ticketSettings).forEach(([k, v]) => 
      console.log(`  ${k} = ${JSON.stringify(v)} (${typeof v})`)
    );

    // Check auto-assignment evaluation
    const autoAssignEnabled = ticketSettings.ticket_auto_assignment === 'true' || ticketSettings.ticket_auto_assignment === true;
    console.log(`\n=== Auto-assign enabled: ${autoAssignEnabled} ===`);
    console.log(`  raw value: ${JSON.stringify(ticketSettings.ticket_auto_assignment)} (${typeof ticketSettings.ticket_auto_assignment})`);

    // Test the actual query
    const dept = 4; // Siddhartha's department
    const q1 = `
      SELECT TOP 1 u.user_id, u.email, 
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
        u.department_id
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE r.role_code = 'ENGINEER'
        AND u.is_active = 1
        AND u.department_id = @departmentId
      ORDER BY 
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = u.user_id) ASC,
        u.user_id ASC
    `;
    const r1 = await executeQuery(q1, { departmentId: dept });
    console.log(`\n=== Round-robin query (dept=${dept}) ===`);
    console.log(`  Results: ${r1.recordset.length}`);
    r1.recordset.forEach(e => console.log(`  ${e.full_name} (ID:${e.user_id}, dept:${e.department_id})`));

    // Fallback query
    const q2 = `
      SELECT TOP 1 u.user_id, u.email, 
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
        u.department_id
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE r.role_code = 'ENGINEER'
        AND u.is_active = 1
      ORDER BY 
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = u.user_id) ASC,
        u.user_id ASC
    `;
    const r2 = await executeQuery(q2);
    console.log(`\n=== Fallback query (all depts) ===`);
    console.log(`  Results: ${r2.recordset.length}`);
    r2.recordset.forEach(e => console.log(`  ${e.full_name} (ID:${e.user_id}, dept:${e.department_id})`));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message, err.stack);
    process.exit(1);
  }
})();
