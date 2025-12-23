import { NextRequest } from 'next/server';
import { StudioDecisionEngine, StudioScenario, StudioActivityEvent } from '@/lib/orchestration/studio-decision-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate required fields
  if (!body.scenario || !body.scenario.id || !body.scenario.summary) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: scenario.id, scenario.summary' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Build scenario from request
  const scenario: StudioScenario = {
    id: body.scenario.id,
    name: body.scenario.name || body.scenario.summary,
    category: body.scenario.category || 'service_desk',
    summary: body.scenario.summary,
    description: body.scenario.description || body.scenario.summary,
    priority: body.scenario.priority || 'medium',
    expected_tier: body.scenario.expected_tier || 'edge',
    mcp_tool: body.scenario.mcp_tool,
    mcp_params: body.scenario.mcp_params,
  };

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const engine = new StudioDecisionEngine();

      // Send activity events as they occur
      engine.on('activity', (event: StudioActivityEvent) => {
        const data = JSON.stringify({
          type: 'activity',
          event,
        });
        controller.enqueue(encoder.encode(`event: activity\ndata: ${data}\n\n`));
      });

      try {
        // Process the scenario
        const result = await engine.processScenario(scenario);

        // Send completion event
        const completeData = JSON.stringify({
          type: 'complete',
          result: {
            success: result.success,
            scenario_id: result.scenario_id,
            session_id: result.session_id,
            tiers: result.tiers,
            total_latency_ms: result.total_latency_ms,
            total_tokens: result.total_tokens,
            total_cost_usd: result.total_cost_usd,
            resolution: result.resolution,
            final_tier: result.final_tier,
            ticket_output: result.ticket_output,
          },
        });
        controller.enqueue(encoder.encode(`event: complete\ndata: ${completeData}\n\n`));
      } catch (error) {
        // Send error event
        const errorData = JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        controller.enqueue(encoder.encode(`event: error\ndata: ${errorData}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
