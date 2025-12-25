// Core domain types for the hybrid AI agent system

export interface Incident {
  id: string;
  tenantId: string;
  summary: string;
  description: string;
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'escalated' | 'closed';
  user: {
    email: string;
    name: string;
  };
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Resolution {
  incidentId: string;
  agent: 'npu' | 'cloud';
  resolution: string;
  confidence: number;
  agentChain?: AgentResponse[];
  resolvedAt: Date;
}

export interface Escalation {
  incidentId: string;
  reason: string;
  agentChain?: AgentResponse[];
  escalatedAt: Date;
}

export interface AgentResponse {
  agentId: string;
  role: AgentRole;
  result: {
    resolution?: string;
    nextAgent?: AgentRole;
    confidence: number;
    reasoning: string;
  };
  metadata: {
    tokensUsed: number;
    duration: number;
  };
}

export type AgentRole =
  | 'classifier'
  | 'network_resolver'
  | 'security_resolver'
  | 'application_resolver'
  | 'escalation_handler';

// NPU Agent types
export interface NPUResolutionResult {
  confidence: number;
  resolution: string;
  reasoning: string;
  similar_incidents: string[];
  should_escalate: boolean;
  escalation_reason?: string;
  // Token usage fields (added for studio metrics)
  tokens_input?: number;
  tokens_output?: number;
}

// Routing decision types
export interface RoutingDecision {
  route: 'npu' | 'cloud' | 'human';
  reasoning: string;
  confidence: number;
}

// API response types
export interface IncidentIntakeResponse {
  success: boolean;
  incidentId: string;
  haloTicketId?: number;
  routing: RoutingDecision;
  resolution?: {
    agent: 'npu' | 'cloud';
    resolution: string;
    confidence: number;
  };
  error?: string;
}
