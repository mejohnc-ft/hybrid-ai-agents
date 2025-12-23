import { NextRequest, NextResponse } from 'next/server';
import { DemoDecisionEngine } from '@/lib/orchestration/demo-decision-engine';
import { CloudConfigurationError } from '@/lib/agents/cloud-client';
import type { Incident } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.summary || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: summary, description' },
        { status: 400 }
      );
    }

    // Create incident object
    const incident: Incident = {
      id: crypto.randomUUID(),
      summary: body.summary,
      description: body.description,
      priority: body.priority || 'medium',
      status: 'open',
      category: body.category,
      user: {
        email: 'demo@example.com',
        name: 'Demo User',
      },
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Process with decision engine
    const engine = new DemoDecisionEngine();
    const events: any[] = [];

    // Collect activity events
    engine.on('activity', (event) => {
      events.push(event);
    });

    // Process incident
    const result = await engine.routeIncident(incident);

    // Get full incident details
    const details = engine.getIncidentDetails(incident.id);

    // Build response
    const response = {
      success: true,
      incidentId: incident.id,
      classification: details.routing?.route === 'npu' ? 'T1 Incident' : 'T2+ Incident',
      route: result.agent,
      reasoning: details.routing?.reasoning || 'Processing...',
      confidence: result.confidence,
      status: result.success ? 'Resolved' : 'Escalated',
      resolution: result.resolution,
      latency: result.latency,
      agent: result.agent,
      category: undefined, // Will be added from cloud result if available
      estimatedTime: undefined, // Will be added from cloud result if available
      events: events,
      escalated: result.escalated,
      escalationReason: result.escalationReason,
    };

    // If cloud agent was used, parse additional metadata
    if (result.agent === 'cloud' && details.resolution?.agent_chain) {
      try {
        const agentChain = JSON.parse(details.resolution.agent_chain);
        response.category = agentChain.category;
        response.estimatedTime = agentChain.estimated_time;
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof CloudConfigurationError) {
      return NextResponse.json(
        {
          error: 'Cloud agent is not configured correctly.',
          details:
            'Set CLOUD_AI_API_KEY and CLOUD_AI_BASE_URL (Azure endpoints require CLOUD_AI_MODEL for the deployment name and optional AZURE_OPENAI_API_VERSION).',
        },
        { status: 400 }
      );
    }

    console.error('Demo processing error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
