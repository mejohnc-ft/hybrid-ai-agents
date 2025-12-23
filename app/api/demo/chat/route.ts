import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { npuAgent } from '@/lib/agents/npu-client';
import { getDemoDB, DemoChatMessage } from '@/lib/demo-db';

export const dynamic = 'force-dynamic';

function normalizeHistory(history: DemoChatMessage[]) {
  return history.map(message => ({
    ...message,
    escalated: message.escalated ? Boolean(message.escalated) : false,
    route: message.route || undefined,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const db = getDemoDB();
    const sessionId = request.nextUrl.searchParams.get('sessionId') || randomUUID();

    const history = db.getChatHistory(sessionId);
    const normalizedHistory = normalizeHistory(history);
    const latestAgent = [...normalizedHistory].reverse().find(entry => entry.role === 'agent');

    return NextResponse.json({
      sessionId,
      route: latestAgent?.route || 'npu',
      messages: normalizedHistory,
    });
  } catch (error) {
    console.error('Failed to fetch chat history', error);
    return NextResponse.json(
      { error: 'Unable to load chat history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userMessage = (body.message || '').trim();
    if (!userMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const db = getDemoDB();
    const sessionId: string = body.sessionId || randomUUID();

    db.createChatMessage({
      session_id: sessionId,
      role: 'user',
      content: userMessage,
    });

    let route: 'npu' | 'cloud' = 'npu';
    let agentReply = '';
    let confidence = 0;
    let latency = 0;
    let escalated = false;

    const start = Date.now();
    try {
      const result = await npuAgent.resolveIncident({
        id: randomUUID(),
        summary: userMessage,
        description: userMessage,
        user: { email: 'demo@example.com', name: 'Demo User' },
        metadata: { sessionId },
      });

      latency = Date.now() - start;
      agentReply = result.resolution;
      confidence = result.confidence;
      escalated = result.should_escalate;
      route = result.should_escalate ? 'cloud' : 'npu';
    } catch (error) {
      console.error('NPU chat error:', error);
      latency = Date.now() - start;
      agentReply =
        'Local NPU agent is unavailable. Please retry or escalate to the cloud agent.';
      confidence = 0;
      escalated = true;
      route = 'cloud';
    }

    db.createChatMessage({
      session_id: sessionId,
      role: 'agent',
      content: agentReply,
      route,
      confidence,
      latency_ms: latency,
      escalated: escalated ? 1 : 0,
    });

    const history = normalizeHistory(db.getChatHistory(sessionId));

    return NextResponse.json({
      sessionId,
      route,
      response: agentReply,
      confidence,
      latency,
      escalated,
      history,
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
