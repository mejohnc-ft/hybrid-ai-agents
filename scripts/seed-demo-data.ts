#!/usr/bin/env ts-node

/**
 * Demo Data Seeder Script
 *
 * Seeds the SQLite database with test scenarios and sample resolutions
 * for the Copilot+ PC demo.
 *
 * Usage:
 *   npm run seed-demo
 */

import { getDemoDB } from '../lib/demo-db';

const demoScenarios = [
  // T1 Scenarios (should route to NPU)
  {
    summary: 'User forgot password',
    description: 'John Doe cannot log into email account after vacation',
    priority: 'medium' as const,
    expectedRoute: 'npu' as const,
    category: 'Access',
  },
  {
    summary: 'License activation failed',
    description: 'Office 365 license not activating on new laptop',
    priority: 'low' as const,
    expectedRoute: 'npu' as const,
    category: 'Licensing',
  },
  {
    summary: 'Account locked after failed logins',
    description: 'User account locked, needs immediate unlock',
    priority: 'high' as const,
    expectedRoute: 'npu' as const,
    category: 'Access',
  },
  {
    summary: 'Printer not responding',
    description: 'Office printer offline, print jobs stuck in queue',
    priority: 'low' as const,
    expectedRoute: 'npu' as const,
    category: 'Hardware',
  },
  {
    summary: 'Email not syncing on mobile device',
    description: 'User reports Outlook not syncing on iPhone since this morning',
    priority: 'medium' as const,
    expectedRoute: 'npu' as const,
    category: 'Email',
  },

  // T2+ Scenarios (should escalate to cloud)
  {
    summary: 'VPN connection failing for entire remote team',
    description: 'All remote users unable to connect to VPN since 9am',
    priority: 'critical' as const,
    expectedRoute: 'cloud' as const,
    category: 'Network',
  },
  {
    summary: 'Suspicious email attachments - possible malware',
    description: 'Multiple users received suspicious emails, need security analysis',
    priority: 'high' as const,
    expectedRoute: 'cloud' as const,
    category: 'Security',
  },
  {
    summary: 'CRM integration broken after update',
    description: 'Salesforce-Dynamics integration failing, sync errors',
    priority: 'high' as const,
    expectedRoute: 'cloud' as const,
    category: 'Application',
  },
  {
    summary: 'Database performance degradation',
    description: 'Production SQL Server experiencing slow queries and timeouts',
    priority: 'critical' as const,
    expectedRoute: 'cloud' as const,
    category: 'Database',
  },

  // Edge Cases (demonstrates escalation logic)
  {
    summary: 'Email sync issues',
    description: 'Unclear if this is client config or server issue',
    priority: 'medium' as const,
    expectedRoute: 'npu' as const, // NPU tries, may escalate
    category: 'Email',
  },
];

async function seedDatabase() {
  console.log('🌱 Seeding demo database...\n');

  const db = getDemoDB();

  // Clear existing data
  console.log('📝 Clearing existing data...');
  db.clearAll();
  console.log('✓ Database cleared\n');

  // Seed test scenarios
  console.log('📦 Seeding test scenarios...');
  for (const scenario of demoScenarios) {
    const incident = db.createIncident({
      summary: scenario.summary,
      description: scenario.description,
      priority: scenario.priority,
      status: 'open',
    });

    console.log(`  ✓ Created incident: ${scenario.summary}`);
  }

  console.log(`\n✓ Seeded ${demoScenarios.length} test scenarios\n`);

  // Display statistics
  const analytics = db.getAnalytics();
  console.log('📊 Database Statistics:');
  console.log(`  Total Incidents: ${analytics.totalIncidents}`);
  console.log(`  NPU Resolved: ${analytics.npuResolved}`);
  console.log(`  Cloud Resolved: ${analytics.cloudResolved}`);

  console.log('\n✅ Demo database seeding complete!\n');

  db.close();
}

// Run seeder
seedDatabase().catch((error) => {
  console.error('❌ Error seeding database:', error);
  process.exit(1);
});
