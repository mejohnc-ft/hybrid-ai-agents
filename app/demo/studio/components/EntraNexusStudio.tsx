'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useScenarioProcessor, ActivityEvent, TierResult } from '../hooks/useScenarioProcessor';
import { ALL_SCENARIOS, WINDOWS_SCENARIOS, SERVICE_DESK_SCENARIOS } from '../lib/scenarios';
import type { StudioScenario } from '@/lib/orchestration/studio-decision-engine';

interface EntraNexusStudioProps {
  onSettingsOpen: () => void;
}

// Icon components
const CloudIcon = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
  </svg>
);

const CpuIcon = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const ServerIcon = () => (
  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// Tier Card Component
function TierCard({
  title,
  subtitle,
  icon,
  model,
  isActive,
  tierData,
  color,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  model: string;
  isActive: boolean;
  tierData: TierResult | null;
  color: 'blue' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: {
      border: isActive ? 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]' : 'border-slate-800',
      bg: isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500',
      gradient: 'from-blue-600 to-cyan-400',
    },
    purple: {
      border: isActive ? 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'border-slate-800',
      bg: isActive ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-500',
      gradient: 'from-purple-600 to-pink-400',
    },
    orange: {
      border: isActive ? 'border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.3)]' : 'border-slate-800',
      bg: isActive ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500',
      gradient: 'from-orange-600 to-yellow-400',
    },
  };

  const classes = colorClasses[color];

  return (
    <div className={`relative group rounded-2xl border transition-all duration-500 overflow-hidden ${classes.border} bg-slate-900/50`}>
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${classes.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${classes.bg}`}>
              {icon}
            </div>
            <div>
              <h2 className="font-semibold text-white">{title}</h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-700 rounded">
              {model}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 font-mono text-xs h-28 overflow-y-auto">
            {isActive ? (
              <div className="flex items-center space-x-2 text-blue-400">
                <RefreshIcon />
                <span>Processing...</span>
              </div>
            ) : tierData?.active ? (
              <div className="space-y-1">
                <div className="text-green-400">Latency: {tierData.latency_ms}ms</div>
                <div className="text-slate-400">Tokens: {tierData.tokens_input + tierData.tokens_output}</div>
                <div className="text-slate-400">Confidence: {(tierData.confidence * 100).toFixed(0)}%</div>
                {tierData.cost_usd > 0 && (
                  <div className="text-yellow-400">Cost: ${tierData.cost_usd.toFixed(4)}</div>
                )}
                <div className={tierData.decision === 'resolve' ? 'text-green-400' : 'text-orange-400'}>
                  Decision: {tierData.decision}
                </div>
              </div>
            ) : (
              <div className="text-slate-700">
                {`// ${title} idle`}<br />
                {`// Awaiting activation`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Console Output Component
function ConsoleOutput({
  events,
  ticketOutput,
  activeTab,
  setActiveTab,
  result,
}: {
  events: ActivityEvent[];
  ticketOutput: string;
  activeTab: 'console' | 'ticket' | 'tokens';
  setActiveTab: (tab: 'console' | 'ticket' | 'tokens') => void;
  result: any;
}) {
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [events]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'mcp': return 'text-orange-500';
      case 'edge': return 'text-purple-500';
      case 'cloud': return 'text-blue-500';
      case 'system': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  };

  const getEventColor = (eventType: string) => {
    if (eventType.includes('error')) return 'text-red-400';
    if (eventType.includes('result') || eventType.includes('completed')) return 'text-green-400';
    if (eventType.includes('routing') || eventType.includes('processing')) return 'text-blue-300';
    return 'text-slate-300';
  };

  return (
    <div className="bg-black border border-slate-800 rounded-xl p-4 font-mono text-sm overflow-hidden flex flex-col h-[500px] shadow-inner">
      <div className="flex items-center justify-between text-slate-500 border-b border-slate-900 pb-2 mb-2">
        <div className="flex space-x-4">
          {(['console', 'tokens', 'ticket'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-bold uppercase tracking-wider pb-2 border-b-2 transition-colors ${
                activeTab === tab
                  ? tab === 'console'
                    ? 'text-blue-400 border-blue-400'
                    : tab === 'tokens'
                    ? 'text-purple-400 border-purple-400'
                    : 'text-green-400 border-green-400'
                  : 'text-slate-600 border-transparent hover:text-slate-400'
              }`}
            >
              {tab === 'console' ? 'Output Console' : tab === 'tokens' ? 'Token Usage' : 'Ticket Output'}
            </button>
          ))}
        </div>
        <span className="text-xs opacity-50">v3.0.0-Studio</span>
      </div>

      <div ref={consoleRef} className="flex-1 overflow-y-auto space-y-1.5 pr-2">
        {activeTab === 'console' ? (
          events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-700 italic space-y-2">
              <ServerIcon />
              <span>Select a scenario to begin processing</span>
            </div>
          ) : (
            events.map((event, idx) => (
              <div key={idx} className="flex space-x-3">
                <span className="text-slate-600 min-w-[60px] text-xs pt-0.5 font-mono select-none">
                  {event.timestamp}ms
                </span>
                <div className="flex items-start space-x-2 flex-1">
                  <span className={`text-xs font-bold uppercase tracking-wider select-none ${getTierColor(event.tier)}`}>
                    {event.tier}:
                  </span>
                  <span className={getEventColor(event.eventType)}>
                    {event.description}
                  </span>
                </div>
              </div>
            ))
          )
        ) : activeTab === 'tokens' ? (
          <div className="p-4 space-y-4">
            {result ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-500 uppercase mb-1">Input Tokens</div>
                    <div className="text-2xl font-mono text-blue-400">{result.total_tokens?.input || 0}</div>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                    <div className="text-xs text-slate-500 uppercase mb-1">Output Tokens</div>
                    <div className="text-2xl font-mono text-purple-400">{result.total_tokens?.output || 0}</div>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-500 uppercase mb-2">Cost Breakdown</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Edge (Local)</span>
                      <span className="text-green-400">$0.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Cloud API</span>
                      <span className="text-yellow-400">${result.total_cost_usd?.toFixed(4) || '0.0000'}</span>
                    </div>
                    <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-bold">
                      <span className="text-white">Total</span>
                      <span className="text-white">${result.total_cost_usd?.toFixed(4) || '0.0000'}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-slate-600 text-center py-8">
                Run a scenario to see token usage
              </div>
            )}
          </div>
        ) : (
          <div className="p-2">
            {ticketOutput ? (
              <pre className="text-xs text-green-400 whitespace-pre-wrap">{ticketOutput}</pre>
            ) : (
              <div className="text-slate-600 text-center py-8">
                Run a scenario to generate ticket output
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main Component
export function EntraNexusStudio({ onSettingsOpen }: EntraNexusStudioProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'windows' | 'service_desk'>('all');
  const [activeTab, setActiveTab] = useState<'console' | 'ticket' | 'tokens'>('console');

  const {
    isProcessing,
    currentTier,
    events,
    result,
    error,
    processScenario,
  } = useScenarioProcessor();

  const scenarios = selectedCategory === 'all'
    ? ALL_SCENARIOS
    : selectedCategory === 'windows'
    ? WINDOWS_SCENARIOS
    : SERVICE_DESK_SCENARIOS;

  const handleRunScenario = (scenario: StudioScenario) => {
    setActiveTab('console');
    processScenario(scenario, true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2.5 rounded-xl shadow-lg">
                <ServerIcon />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Entra Nexus Studio</h1>
                <p className="text-xs text-slate-400">Hybrid AI Agent Demo - Edge to Cloud</p>
              </div>
            </div>
            <button
              onClick={onSettingsOpen}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <SettingsIcon />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Metrics Bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total Latency</div>
            <div className="text-2xl font-bold text-blue-400">
              {result?.total_latency_ms ? `${result.total_latency_ms}ms` : '--'}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Total Tokens</div>
            <div className="text-2xl font-bold text-purple-400">
              {result?.total_tokens ? result.total_tokens.input + result.total_tokens.output : '--'}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">API Cost</div>
            <div className="text-2xl font-bold text-yellow-400">
              {result?.total_cost_usd !== undefined ? `$${result.total_cost_usd.toFixed(4)}` : '--'}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Final Tier</div>
            <div className={`text-2xl font-bold ${
              result?.final_tier === 'cloud' ? 'text-blue-400' :
              result?.final_tier === 'edge' ? 'text-purple-400' :
              result?.final_tier === 'mcp' ? 'text-orange-400' : 'text-slate-600'
            }`}>
              {result?.final_tier?.toUpperCase() || '--'}
            </div>
          </div>
        </div>

        {/* Three-Tier Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <TierCard
            title="Azure AI Foundry"
            subtitle="Cloud Orchestration"
            icon={<CloudIcon />}
            model="GPT-4o"
            isActive={currentTier === 'cloud'}
            tierData={result?.tiers?.cloud || null}
            color="blue"
          />

          <TierCard
            title="Foundry Local"
            subtitle="Edge Runtime (NPU)"
            icon={<CpuIcon />}
            model="Phi-3.5"
            isActive={currentTier === 'edge'}
            tierData={result?.tiers?.edge || null}
            color="purple"
          />

          <TierCard
            title="MCP Tools"
            subtitle="Windows 11"
            icon={<ServerIcon />}
            model="Native"
            isActive={currentTier === 'mcp'}
            tierData={result?.tiers?.mcp || null}
            color="orange"
          />
        </div>

        {/* Control Panel & Console */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Scenario Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col h-[500px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-300">Scenarios</h3>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300"
              >
                <option value="all">All</option>
                <option value="windows">Windows IT</option>
                <option value="service_desk">Service Desk</option>
              </select>
            </div>

            <div className="space-y-2 overflow-y-auto pr-2 flex-1">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => handleRunScenario(scenario)}
                  disabled={isProcessing}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between group
                    bg-slate-800 border-slate-700 hover:bg-slate-700
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                      {scenario.name}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        scenario.category === 'windows' ? 'bg-orange-900/30 text-orange-400' : 'bg-blue-900/30 text-blue-400'
                      }`}>
                        {scenario.category === 'windows' ? 'Windows' : 'Service Desk'}
                      </span>
                      <span>{scenario.expected_tier.toUpperCase()}</span>
                    </div>
                  </div>
                  {isProcessing ? (
                    <RefreshIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Console Output */}
          <div className="lg:col-span-2">
            <ConsoleOutput
              events={events}
              ticketOutput={result?.ticket_output || ''}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              result={result}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
