'use client';

import { useState } from 'react';
import { ActivityTimeline, TimelineEvent } from './components/ActivityTimeline';
import { RoutingVisualizer } from './components/RoutingVisualizer';
import { TicketPreview } from './components/TicketPreview';

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'T1: Password Reset',
    summary: 'User forgot password',
    description: 'John Doe reports that he forgot his password and cannot log into his email account after returning from vacation',
    priority: 'medium' as const,
  },
  {
    name: 'T1: License Activation',
    summary: 'Office 365 license activation failed',
    description: 'New laptop setup - Office 365 license not activating, showing error code 0x80070005',
    priority: 'low' as const,
  },
  {
    name: 'T1: Account Locked',
    summary: 'Account locked after failed login attempts',
    description: 'User account locked due to multiple failed login attempts, needs immediate unlock for important meeting',
    priority: 'high' as const,
  },
  {
    name: 'T2+: VPN Connection Issue',
    summary: 'VPN connection failing for entire remote team',
    description: 'All remote users unable to connect to corporate VPN since 9am this morning. Getting "connection timeout" error',
    priority: 'critical' as const,
  },
  {
    name: 'T2+: Security Alert',
    summary: 'Suspicious email attachments - possible malware',
    description: 'Multiple users received suspicious emails with attachments claiming to be invoices. Need security analysis and threat assessment',
    priority: 'high' as const,
  },
  {
    name: 'T2+: Integration Failure',
    summary: 'CRM integration broken after system update',
    description: 'Salesforce-Dynamics 365 integration stopped working after last night\'s update. Sync errors and data conflicts',
    priority: 'high' as const,
  },
];

export default function DemoPage() {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [processing, setProcessing] = useState(false);

  // Results state
  const [incidentId, setIncidentId] = useState('');
  const [classification, setClassification] = useState('');
  const [route, setRoute] = useState<'npu' | 'cloud'>('npu');
  const [reasoning, setReasoning] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [status, setStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [latency, setLatency] = useState(0);
  const [agent, setAgent] = useState<'npu' | 'cloud'>('npu');
  const [category, setCategory] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');

  const [events, setEvents] = useState<TimelineEvent[]>([]);

  const loadScenario = (index: number) => {
    const scenario = TEST_SCENARIOS[index];
    setSummary(scenario.summary);
    setDescription(scenario.description);
    setPriority(scenario.priority);
    // Reset results
    setEvents([]);
    setIncidentId('');
    setClassification('');
    setStatus('');
    setResolution('');
  };

  const submitIncident = async () => {
    if (!summary || !description) {
      alert('Please fill in summary and description');
      return;
    }

    setProcessing(true);
    setEvents([]);
    setIncidentId('');
    setClassification('');
    setStatus('in_progress');
    setResolution('');

    try {
      // Submit incident and stream results
      const response = await fetch('/api/demo/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary,
          description,
          priority,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process incident');
      }

      const result = await response.json();

      // Set final results
      setIncidentId(result.incidentId);
      setClassification(result.classification);
      setRoute(result.route);
      setReasoning(result.reasoning);
      setConfidence(result.confidence);
      setStatus(result.status);
      setResolution(result.resolution);
      setLatency(result.latency);
      setAgent(result.agent);
      setCategory(result.category || '');
      setEstimatedTime(result.estimatedTime || '');
      setEvents(result.events || []);
    } catch (error) {
      console.error('Error processing incident:', error);
      alert('Error processing incident. Please check console for details.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <h1 className="text-3xl font-bold mb-2">🤖 Hybrid AI Service Desk - Live Demo</h1>
          <p className="text-blue-100">
            Edge-to-Cloud AI Agent System for Intelligent Service Desk Automation
          </p>
        </div>

        {/* Incident Submission */}
        <div className="bg-white rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>📝</span>
            <span>Submit Test Incident</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Summary
              </label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief description of the issue"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={processing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of the incident"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={processing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`px-4 py-2 rounded-md font-medium capitalize transition-colors ${
                      priority === p
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    disabled={processing}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={submitIncident}
                disabled={processing}
                className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {processing ? 'Processing...' : 'Submit Incident'}
              </button>

              <div className="relative">
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-300 transition-colors"
                  disabled={processing}
                >
                  Load Example ▼
                </button>
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 hidden group-hover:block">
                  {TEST_SCENARIOS.map((scenario, index) => (
                    <button
                      key={index}
                      onClick={() => loadScenario(index)}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                      disabled={processing}
                    >
                      {scenario.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick load buttons */}
            <div className="border-t pt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Quick Load Examples:</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {TEST_SCENARIOS.map((scenario, index) => (
                  <button
                    key={index}
                    onClick={() => loadScenario(index)}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 text-left transition-colors"
                    disabled={processing}
                  >
                    {scenario.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        {incidentId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <RoutingVisualizer
                classification={classification}
                route={route}
                reasoning={reasoning}
                confidence={confidence}
                status={status}
                latency={latency}
              />

              <ActivityTimeline events={events} />
            </div>

            {/* Right Column */}
            <div>
              <TicketPreview
                incidentId={incidentId}
                summary={summary}
                status={status}
                agent={agent}
                resolution={resolution}
                confidence={confidence}
                latency={latency}
                category={category}
                estimatedTime={estimatedTime}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
