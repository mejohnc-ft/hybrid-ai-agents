'use client';

import { useEffect, useRef } from 'react';

export interface TimelineEvent {
  timestamp: number; // milliseconds from start
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  autoScroll?: boolean;
}

export function ActivityTimeline({ events, autoScroll = true }: ActivityTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'incident_received':
        return '✓';
      case 'classified':
        return '✓';
      case 'routing':
        return '→';
      case 'rag_search':
        return '🔍';
      case 'npu_inference':
        return '🧠';
      case 'npu_result':
        return '✓';
      case 'npu_unavailable':
        return '⚠';
      case 'escalation_triggered':
        return '⚠';
      case 'cloud_routing':
        return '→';
      case 'cloud_processing':
        return '☁';
      case 'cloud_result':
        return '✓';
      case 'resolution_accepted':
        return '✓';
      case 'human_escalation':
        return '👤';
      case 'kb_sync':
        return '←';
      case 'npu_error':
      case 'cloud_error':
        return '❌';
      default:
        return '•';
    }
  };

  const getEventColor = (eventType: string) => {
    if (eventType.includes('error') || eventType.includes('unavailable')) {
      return 'text-red-600';
    }
    if (eventType.includes('escalation') || eventType.includes('warning')) {
      return 'text-yellow-600';
    }
    if (eventType.includes('result') || eventType.includes('accepted')) {
      return 'text-green-600';
    }
    if (eventType.includes('cloud')) {
      return 'text-blue-600';
    }
    return 'text-gray-600';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span>⚡</span>
        <span>Agent Activity Timeline</span>
      </h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Waiting for activity...</p>
        ) : (
          events.map((event, index) => (
            <div key={index} className="flex items-start gap-3 text-sm">
              <span className="text-gray-400 font-mono text-xs w-12 flex-shrink-0">
                {(event.timestamp / 1000).toFixed(1)}s
              </span>
              <span className={`flex-shrink-0 ${getEventColor(event.eventType)}`}>
                {getEventIcon(event.eventType)}
              </span>
              <span className="text-gray-700 flex-1">{event.description}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
