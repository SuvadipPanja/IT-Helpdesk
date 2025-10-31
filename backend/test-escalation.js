// ============================================
// TEST AUTO-ESCALATION JOB
// Run this file to test the escalation job manually
// Usage: node backend/test-escalation.js
// ============================================

const { runAutoEscalation } = require('./jobs/autoEscalation_job');

console.log('╔════════════════════════════════════════════╗');
console.log('║   🧪 TESTING AUTO-ESCALATION JOB          ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');

console.log('⏳ Starting test...\n');

runAutoEscalation()
  .then(result => {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   ✅ TEST COMPLETE!                        ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 Result Summary:');
    console.log('─────────────────────────────────────────────');
    console.log(`✅ Success:           ${result.success}`);
    console.log(`📝 Message:           ${result.message}`);
    console.log(`🎫 Tickets Escalated: ${result.ticketsEscalated || 0}`);
    
    if (result.ticketsFailed) {
      console.log(`❌ Tickets Failed:    ${result.ticketsFailed}`);
    }
    
    if (result.duration) {
      console.log(`⏱️  Duration:          ${result.duration} seconds`);
    }
    
    console.log('─────────────────────────────────────────────');
    console.log('');
    
    if (result.ticketsEscalated > 0) {
      console.log('✅ Check your:');
      console.log('   1. Tickets page - Status should be "Escalated"');
      console.log('   2. Email inbox - Should have escalation emails');
      console.log('   3. Ticket activity - Should show escalation log');
      console.log('');
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   ❌ TEST FAILED!                          ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log('Error Details:');
    console.log('─────────────────────────────────────────────');
    console.error(error);
    console.log('─────────────────────────────────────────────');
    console.log('');
    console.log('💡 Common Issues:');
    console.log('   1. Database connection failed');
    console.log('   2. "Escalated" status not found in ticket_statuses table');
    console.log('   3. Email template not found in email_templates table');
    console.log('   4. SMTP settings not configured');
    console.log('');
    
    process.exit(1);
  });