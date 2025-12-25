import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { npuAgent } from '@/lib/agents/npu-client';
import { Incident, IncidentIntakeResponse } from '@/lib/types';

const getTenantId = (request: NextRequest) => request.headers.get('x-tenant-id');

export async function POST(request: NextRequest) {
  try {
    const tenantId = getTenantId(request);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing required header: x-tenant-id' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.summary || !body.description || !body.user) {
      return NextResponse.json(
        { error: 'Missing required fields: summary, description, user' },
        { status: 400 }
      );
    }

    // Step 1: Create incident record in Supabase
    const { data: incident, error: insertError } = await supabase
      .from('incidents')
      .insert({
        tenant_id: tenantId,
        summary: body.summary,
        description: body.description,
        category: body.category || null,
        priority: body.priority || 'medium',
        status: 'open',
        user_email: body.user.email,
        user_name: body.user.name,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (insertError || !incident) {
      console.error('Failed to create incident:', insertError);
      return NextResponse.json(
        { error: 'Failed to create incident record' },
        { status: 500 }
      );
    }

    // Step 2: Attempt NPU agent resolution for T1 incidents
    try {
      // Check if NPU agent is available
      const health = await npuAgent.healthCheck();

      if (health.status === 'healthy') {
        // Try to resolve with NPU agent
        const resolution = await npuAgent.resolveIncident({
          id: incident.id,
          summary: incident.summary,
          description: incident.description,
          category: incident.category || undefined,
          user: {
            email: incident.user_email,
            name: incident.user_name,
          },
          metadata: incident.metadata as Record<string, unknown>,
        });

        // If NPU agent resolved it confidently, record the resolution
        if (!resolution.should_escalate) {
          // Update incident status
          await supabase
            .from('incidents')
            .update({ status: 'resolved' })
            .eq('id', incident.id);

          // Record resolution
          await supabase.from('incident_resolutions').insert({
            incident_id: incident.id,
            tenant_id: tenantId,
            agent: 'npu',
            resolution: resolution.resolution,
            confidence: resolution.confidence,
          });

          const response: IncidentIntakeResponse = {
            success: true,
            incidentId: incident.id,
            routing: {
              route: 'npu',
              reasoning: 'Resolved by local NPU agent',
              confidence: resolution.confidence,
            },
            resolution: {
              agent: 'npu',
              resolution: resolution.resolution,
              confidence: resolution.confidence,
            },
          };

          return NextResponse.json(response, { status: 200 });
        } else {
          // NPU escalated - will need cloud handling
          // For now, just mark as in_progress
          await supabase
            .from('incidents')
            .update({ status: 'in_progress' })
            .eq('id', incident.id);

          const response: IncidentIntakeResponse = {
            success: true,
            incidentId: incident.id,
            routing: {
              route: 'cloud',
              reasoning: resolution.escalation_reason || 'Escalated to cloud agents',
              confidence: resolution.confidence,
            },
          };

          return NextResponse.json(response, { status: 200 });
        }
      }
    } catch (npuError) {
      console.error('NPU agent unavailable or failed:', npuError);
      // Continue to return incident created response
    }

    // If NPU agent is unavailable or failed, return incident created
    const response: IncidentIntakeResponse = {
      success: true,
      incidentId: incident.id,
      routing: {
        route: 'cloud',
        reasoning: 'NPU agent unavailable, routing to cloud',
        confidence: 0.5,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Incident intake error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantId(request);

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing required header: x-tenant-id' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('incidents')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: incidents, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ incidents }, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}
