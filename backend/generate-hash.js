// ============================================
// Password Hash Generator
// Generates bcrypt hash for passwords
// ============================================

const bcrypt = require('bcryptjs');

const password = 'Admin@123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    return;
  }
  
  console.log('\n========================================');
  console.log('Password Hash Generated Successfully!');
  console.log('========================================');
  console.log('\nPassword:', password);
  console.log('\nHash:', hash);
  console.log('\n========================================');
  console.log('Copy the hash above and update in SQL Server');
  console.log('========================================\n');
});