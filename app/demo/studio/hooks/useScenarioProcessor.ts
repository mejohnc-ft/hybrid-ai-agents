'use client';

import { useState, useCallback, useRef } from 'react';
import type { StudioScenario } from '@/lib/orchestration/studio-decision-engine';

export interface TierResult {
  active: boolean;
  latency_ms: number;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  response: string;
  confidence: number;
  decision: 'resolve' | 'escalate' | 'error';
  tool_used?: string;
  model?: string;
}

export interface ProcessingResult {
  success: boolean;
  scenario_id: string;
  session_id: string;
  tiers: {
    mcp: TierResult | null;
    edge: TierResult | null;
    cloud: TierResult | null;
  };
  total_latency_ms: number;
  total_tokens: { input: number; output: number };
  total_cost_usd: number;
  resolution: string;
  final_tier: 'mcp' | 'edge' | 'cloud';
  ticket_output: string;
}

export interface ActivityEvent {
  timestamp: number;
  tier: 'mcp' | 'edge' | 'cloud' | 'system';
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface ProcessingState {
  isProcessing: boolean;
  currentTier: 'mcp' | 'edge' | 'cloud' | null;
  events: ActivityEvent[];
  result: ProcessingResult | null;
  error: string | null;
}

export function useScenarioProcessor() {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    currentTier: null,
    events: [],
    result: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const processScenario = useCallback(async (scenario: StudioScenario, useStreaming = true) => {
    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state
    setState({
      isProcessing: true,
      currentTier: null,
      events: [],
      result: null,
      error: null,
    });

    abortControllerRef.current = new AbortController();

    try {
      if (useStreaming) {
        // Use SSE streaming endpoint
        const response = await fetch('/api/demo/studio/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Processing failed: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const chunk of lines) {
            if (!chunk.trim()) continue;

            const eventMatch = chunk.match(/event: (\w+)\ndata: (.+)/);
            if (!eventMatch) continue;

            const [, eventType, data] = eventMatch;
            const parsed = JSON.parse(data);

            if (eventType === 'activity' && parsed.event) {
              const event = parsed.event as ActivityEvent;

              setState((prev) => ({
                ...prev,
                events: [...prev.events, event],
                currentTier: event.tier !== 'system' ? event.tier : prev.currentTier,
              }));
            } else if (eventType === 'complete' && parsed.result) {
              setState((prev) => ({
                ...prev,
                isProcessing: false,
                currentTier: null,
                result: parsed.result,
              }));
            } else if (eventType === 'error') {
              setState((prev) => ({
                ...prev,
                isProcessing: false,
                currentTier: null,
                error: parsed.message,
              }));
            }
          }
        }
      } else {
        // Use regular POST endpoint
        const response = await fetch('/api/demo/studio/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Processing failed: ${response.statusText}`);
        }

        const result = await response.json();

        setState({
          isProcessing: false,
          currentTier: null,
          events: result.timeline || [],
          result,
          error: null,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Ignore abort errors
      }

      setState((prev) => ({
        ...prev,
        isProcessing: false,
        currentTier: null,
        error: error instanceof Error ? error.message : 'Processing failed',
      }));
    }
  }, []);

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState((prev) => ({
      ...prev,
      isProcessing: false,
      currentTier: null,
    }));
  }, []);

  const resetState = useCallback(() => {
    setState({
      isProcessing: false,
      currentTier: null,
      events: [],
      result: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    processScenario,
    cancelProcessing,
    resetState,
  };
}
