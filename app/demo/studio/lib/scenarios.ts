/**
 * Studio Scenarios - Combined Windows IT and Service Desk scenarios
 */

import type { StudioScenario } from '@/lib/orchestration/studio-decision-engine';

// Windows IT Scenarios (from Entra Nexus)
export const WINDOWS_SCENARIOS: StudioScenario[] = [
  {
    id: 'battery',
    name: 'Battery Drain Analysis',
    category: 'windows',
    summary: 'My laptop battery is dying in 2 hours. What\'s wrong?',
    description: 'User reports that their laptop battery is draining much faster than expected. The device was recently updated and the issue started around that time.',
    priority: 'medium',
    expected_tier: 'mcp',
    mcp_tool: 'get_power_usage_report',
    mcp_params: { duration: '24h', sort_by: 'consumption_desc', include_processes: true },
  },
  {
    id: 'wifi',
    name: 'Network Latency Check',
    category: 'windows',
    summary: 'The internet is super laggy during calls.',
    description: 'User experiences high latency and lag during video conference calls. Issue is intermittent but seems to occur during specific times of day.',
    priority: 'high',
    expected_tier: 'mcp',
    mcp_tool: 'get_network_adapter_stats',
    mcp_params: { interface: 'Wi-Fi', check_period: '15m', deep_analysis: true },
  },
  {
    id: 'security',
    name: 'Security Audit (Intrusion)',
    category: 'windows',
    summary: 'I think someone accessed my machine last night.',
    description: 'User suspects unauthorized access to their workstation. They noticed files moved and browser history they don\'t recognize. Need security analysis.',
    priority: 'critical',
    expected_tier: 'cloud',
    mcp_tool: 'query_security_log',
    mcp_params: { event_ids: [4624, 4625], timeframe: 'last_night', include_ip_geo: true },
  },
  {
    id: 'disk',
    name: 'Storage Optimization',
    category: 'windows',
    summary: 'I can\'t save my presentation, disk full.',
    description: 'User unable to save files due to disk space issues. Need to identify large files and recommend cleanup actions.',
    priority: 'medium',
    expected_tier: 'mcp',
    mcp_tool: 'scan_large_files',
    mcp_params: { min_size: '1GB', path: 'C:/Users/', include_temp: true },
  },
  {
    id: 'crash',
    name: 'App Crash Debugging',
    category: 'windows',
    summary: 'Excel keeps crashing when I open macro files.',
    description: 'User experiences repeated crashes in Microsoft Excel when opening files with macros. Need to analyze crash reports and determine root cause.',
    priority: 'high',
    expected_tier: 'edge',
    mcp_tool: 'get_wer_report',
    mcp_params: { app_name: 'excel.exe', recent: 1, include_stack_trace: true },
  },
];

// Service Desk Scenarios (existing)
export const SERVICE_DESK_SCENARIOS: StudioScenario[] = [
  {
    id: 't1-password',
    name: 'T1: Password Reset',
    category: 'service_desk',
    summary: 'User forgot password',
    description: 'John Doe reports that he forgot his password and cannot log into his email account after returning from vacation. Needs password reset assistance.',
    priority: 'medium',
    expected_tier: 'edge',
  },
  {
    id: 't1-license',
    name: 'T1: License Activation',
    category: 'service_desk',
    summary: 'Office 365 license activation failed',
    description: 'New laptop setup - Office 365 license not activating, showing error code 0x80070005. User needs to complete urgent document work.',
    priority: 'low',
    expected_tier: 'edge',
  },
  {
    id: 't1-locked',
    name: 'T1: Account Locked',
    category: 'service_desk',
    summary: 'Account locked after failed login attempts',
    description: 'User account locked due to multiple failed login attempts, needs immediate unlock for important meeting in 30 minutes.',
    priority: 'high',
    expected_tier: 'edge',
  },
  {
    id: 't2-vpn',
    name: 'T2+: VPN Connection Issue',
    category: 'service_desk',
    summary: 'VPN connection failing for entire remote team',
    description: 'All remote users unable to connect to corporate VPN since 9am this morning. Getting "connection timeout" error. 15+ users affected.',
    priority: 'critical',
    expected_tier: 'cloud',
  },
  {
    id: 't2-security',
    name: 'T2+: Security Alert',
    category: 'service_desk',
    summary: 'Suspicious email attachments - possible malware',
    description: 'Multiple users received suspicious emails with attachments claiming to be invoices. Need security analysis and threat assessment.',
    priority: 'high',
    expected_tier: 'cloud',
  },
  {
    id: 't2-integration',
    name: 'T2+: Integration Failure',
    category: 'service_desk',
    summary: 'CRM integration broken after system update',
    description: 'Salesforce-Dynamics 365 integration stopped working after last night\'s update. Sync errors and data conflicts reported.',
    priority: 'high',
    expected_tier: 'cloud',
  },
];

// Combined scenarios
export const ALL_SCENARIOS = [...WINDOWS_SCENARIOS, ...SERVICE_DESK_SCENARIOS];

// Get scenario by ID
export function getScenarioById(id: string): StudioScenario | undefined {
  return ALL_SCENARIOS.find((s) => s.id === id);
}

// Get scenarios by category
export function getScenariosByCategory(category: 'windows' | 'service_desk'): StudioScenario[] {
  return ALL_SCENARIOS.filter((s) => s.category === category);
}
