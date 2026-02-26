const { executeQuery } = require('./config/database');

(async () => {
  try {
    // Check settings
    const s = await executeQuery(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('ticket_auto_assignment','ticket_assignment_method')"
    );
    console.log('=== Auto-assign Settings ===');
    s.recordset.forEach(r => console.log(`  ${r.setting_key} = ${r.setting_value}`));

    // Check roles
    const r = await executeQuery("SELECT role_id, role_name, role_code FROM user_roles");
    console.log('\n=== Roles ===');
    r.recordset.forEach(ro => console.log(`  ID:${ro.role_id} - ${ro.role_name} (${ro.role_code})`));

    // Check engineers
    const u = await executeQuery(`
      SELECT u.user_id, u.first_name, u.last_name, u.is_active, u.department_id, 
             u.role_id, r.role_code, r.role_name
      FROM users u 
      JOIN user_roles r ON u.role_id = r.role_id 
      WHERE r.role_code = 'ENGINEER'
    `);
    console.log('\n=== Engineers (role_code=ENGINEER) ===');
    if (u.recordset.length === 0) {
      console.log('  ** NO ENGINEERS FOUND **');
    } else {
      u.recordset.forEach(e => console.log(`  ID:${e.user_id} - ${e.first_name} ${e.last_name} active:${e.is_active} dept:${e.department_id}`));
    }

    // Check ALL users with their roles
    const all = await executeQuery(`
      SELECT u.user_id, u.first_name, u.last_name, u.is_active, u.department_id, 
             u.role_id, r.role_code, r.role_name
      FROM users u 
      JOIN user_roles r ON u.role_id = r.role_id
      ORDER BY r.role_code, u.user_id
    `);
    console.log('\n=== All Users ===');
    all.recordset.forEach(e => console.log(`  ID:${e.user_id} - ${e.first_name} ${e.last_name} role:${e.role_code}(${e.role_id}) active:${e.is_active} dept:${e.department_id}`));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
