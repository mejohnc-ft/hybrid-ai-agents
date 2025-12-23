import { NextRequest, NextResponse } from 'next/server';
import { StudioDecisionEngine, StudioScenario } from '@/lib/orchestration/studio-decision-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.scenario || !body.scenario.id || !body.scenario.summary) {
      return NextResponse.json(
        { error: 'Missing required fields: scenario.id, scenario.summary' },
        { status: 400 }
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

    // Process scenario through 3-tier system
    const engine = new StudioDecisionEngine();
    const events: Array<{ timestamp: number; tier: string; eventType: string; description: string }> = [];

    // Collect activity events
    engine.on('activity', (event) => {
      events.push(event);
    });

    // Process the scenario
    const result = await engine.processScenario(scenario);

    return NextResponse.json({
      success: result.success,
      scenario_id: result.scenario_id,
      session_id: result.session_id,
      tiers: result.tiers,
      timeline: result.timeline,
      total_latency_ms: result.total_latency_ms,
      total_tokens: result.total_tokens,
      total_cost_usd: result.total_cost_usd,
      resolution: result.resolution,
      final_tier: result.final_tier,
      ticket_output: result.ticket_output,
    });
  } catch (error) {
    console.error('Studio processing error:', error);
    return NextResponse.json(
      {
        error: 'Processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
