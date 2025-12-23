'use client';

import { ConfidenceMeter } from './ConfidenceMeter';

interface RoutingVisualizerProps {
  classification: string;
  route: 'npu' | 'cloud';
  reasoning: string;
  confidence: number;
  status: string;
  latency?: number;
}

export function RoutingVisualizer({
  classification,
  route,
  reasoning,
  confidence,
  status,
  latency,
}: RoutingVisualizerProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span>🎯</span>
        <span>Routing Decision</span>
      </h3>

      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium text-gray-600">Classification</div>
          <div className="text-lg font-semibold text-gray-800">{classification}</div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-600">Routing</div>
          <div className="flex items-center gap-2">
            {route === 'npu' ? (
              <span className="text-lg font-semibold text-green-600">✓ NPU Agent (Local)</span>
            ) : (
              <span className="text-lg font-semibold text-blue-600">☁ Cloud Agent (Azure)</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-600">Reasoning</div>
          <div className="text-sm text-gray-700">{reasoning}</div>
        </div>

        <div>
          <ConfidenceMeter confidence={confidence} threshold={0.7} />
        </div>

        <div>
          <div className="text-sm font-medium text-gray-600">Status</div>
          <div className="flex items-center gap-2">
            {status === 'resolved' ? (
              <span className="text-sm font-semibold text-green-600">
                ✓ Resolved by {route === 'npu' ? 'NPU' : 'Cloud'}
                {latency && ` (${(latency / 1000).toFixed(1)}s)`}
              </span>
            ) : status === 'escalated' ? (
              <span className="text-sm font-semibold text-yellow-600">⚠ Escalated to Cloud</span>
            ) : status === 'in_progress' ? (
              <span className="text-sm font-semibold text-blue-600">⚡ Processing...</span>
            ) : (
              <span className="text-sm font-semibold text-gray-600">⏳ {status}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
