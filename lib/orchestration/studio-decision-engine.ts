/**
 * Studio Decision Engine - 3-tier orchestration for Entra Nexus Studio
 * Coordinates MCP tools, NPU agent, and Cloud agent with full metrics
 */

import { EventEmitter } from 'events';
import { getDemoDB } from '../demo-db';
import { NPUAgentClient } from '../agents/npu-client';
import { GenericCloudAgent, CloudAgentConfig, CloudConfigurationError } from '../agents/cloud-client';
import { MCPClient } from '../agents/mcp-client';
import { settingsStore, SETTING_KEYS } from '../settings-store';
import { calculateCost, estimateTokens } from '../pricing';
import type { Incident } from '../types';

// Activity event types for the studio
export interface StudioActivityEvent {
  timestamp: number;
  tier: 'mcp' | 'edge' | 'cloud' | 'system';
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
}

// Result from each tier
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
  raw_data?: Record<string, unknown>;
}

// Complete studio processing result
export interface StudioResult {
  success: boolean;
  scenario_id: string;
  session_id: string;
  tiers: {
    mcp: TierResult | null;
    edge: TierResult | null;
    cloud: TierResult | null;
  };
  timeline: StudioActivityEvent[];
  total_latency_ms: number;
  total_tokens: {
    input: number;
    output: number;
  };
  total_cost_usd: number;
  resolution: string;
  final_tier: 'mcp' | 'edge' | 'cloud';
  ticket_output: string;
}

// Scenario definition for the studio
export interface StudioScenario {
  id: string;
  name: string;
  category: 'windows' | 'service_desk';
  summary: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  expected_tier: 'mcp' | 'edge' | 'cloud';
  mcp_tool?: string;
  mcp_params?: Record<string, unknown>;
}

const CONFIDENCE_THRESHOLD = 0.70;

export class StudioDecisionEngine extends EventEmitter {
  private db = getDemoDB();
  private timeline: StudioActivityEvent[] = [];
  private startTime = 0;
  private sessionId: string;

  constructor() {
    super();
    this.sessionId = crypto.randomUUID();
  }

  /**
   * Process a scenario through the 3-tier system
   */
  async processScenario(scenario: StudioScenario): Promise<StudioResult> {
    this.startTime = Date.now();
    this.timeline = [];
    this.sessionId = crypto.randomUUID();

    const result: StudioResult = {
      success: false,
      scenario_id: scenario.id,
      session_id: this.sessionId,
      tiers: {
        mcp: null,
        edge: null,
        cloud: null,
      },
      timeline: [],
      total_latency_ms: 0,
      total_tokens: { input: 0, output: 0 },
      total_cost_usd: 0,
      resolution: '',
      final_tier: 'mcp',
      ticket_output: '',
    };

    try {
      // Emit: Scenario started
      this.emitActivity('system', 'scenario_started', `Processing scenario: ${scenario.name}`, {
        scenario_id: scenario.id,
        category: scenario.category,
      });

      // Tier 1: MCP Tools (if applicable)
      if (scenario.mcp_tool) {
        result.tiers.mcp = await this.executeMCPTier(scenario);

        if (result.tiers.mcp.decision === 'resolve') {
          result.success = true;
          result.resolution = result.tiers.mcp.response;
          result.final_tier = 'mcp';
          return this.finalizeResult(result, scenario);
        }
      }

      // Tier 2: Edge/NPU Agent
      result.tiers.edge = await this.executeEdgeTier(scenario, result.tiers.mcp);

      if (result.tiers.edge.decision === 'resolve' && result.tiers.edge.confidence >= CONFIDENCE_THRESHOLD) {
        result.success = true;
        result.resolution = result.tiers.edge.response;
        result.final_tier = 'edge';
        return this.finalizeResult(result, scenario);
      }

      // Tier 3: Cloud Agent
      result.tiers.cloud = await this.executeCloudTier(scenario, result.tiers.edge);

      if (result.tiers.cloud.decision === 'resolve') {
        result.success = true;
        result.resolution = result.tiers.cloud.response;
        result.final_tier = 'cloud';
      } else {
        result.success = false;
        result.resolution = result.tiers.cloud.response || 'Requires human specialist intervention';
        result.final_tier = 'cloud';
      }

      return this.finalizeResult(result, scenario);
    } catch (error) {
      this.emitActivity('system', 'error', `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      result.success = false;
      result.resolution = error instanceof Error ? error.message : 'Unknown error occurred';
      return this.finalizeResult(result, scenario);
    }
  }

  /**
   * Execute MCP tier - Windows system tools
   */
  private async executeMCPTier(scenario: StudioScenario): Promise<TierResult> {
    const tierStart = Date.now();

    this.emitActivity('mcp', 'mcp_routing', `Routing to MCP tool: ${scenario.mcp_tool}`);

    const settings = settingsStore.getAll();

    if (!settings.mcp_server_enabled) {
      this.emitActivity('mcp', 'mcp_disabled', 'MCP server is disabled in settings');
      return {
        active: false,
        latency_ms: Date.now() - tierStart,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        response: 'MCP server disabled',
        confidence: 0,
        decision: 'escalate',
      };
    }

    try {
      const mcpClient = new MCPClient();

      this.emitActivity('mcp', 'mcp_executing', `Executing: ${scenario.mcp_tool}`, scenario.mcp_params);

      const toolResult = await mcpClient.callTool(scenario.mcp_tool!, scenario.mcp_params || {});

      const latency = Date.now() - tierStart;

      if (toolResult.success && toolResult.result) {
        this.emitActivity('mcp', 'mcp_result', 'MCP tool executed successfully', {
          execution_time_ms: toolResult.execution_time_ms,
          result_keys: Object.keys(toolResult.result),
        });

        // Format the result as a response
        const response = this.formatMCPResult(scenario.mcp_tool!, toolResult.result);

        return {
          active: true,
          latency_ms: latency,
          tokens_input: 0, // MCP doesn't use tokens
          tokens_output: 0,
          cost_usd: 0, // Local execution, no cost
          response,
          confidence: 0.9, // High confidence for system data
          decision: 'resolve',
          tool_used: scenario.mcp_tool,
          raw_data: toolResult.result,
        };
      } else {
        this.emitActivity('mcp', 'mcp_error', `MCP tool failed: ${toolResult.error}`);

        return {
          active: true,
          latency_ms: latency,
          tokens_input: 0,
          tokens_output: 0,
          cost_usd: 0,
          response: toolResult.error || 'MCP tool execution failed',
          confidence: 0,
          decision: 'escalate',
          tool_used: scenario.mcp_tool,
        };
      }
    } catch (error) {
      this.emitActivity('mcp', 'mcp_error', `MCP tier error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        active: true,
        latency_ms: Date.now() - tierStart,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        response: error instanceof Error ? error.message : 'MCP tier failed',
        confidence: 0,
        decision: 'escalate',
      };
    }
  }

  /**
   * Execute Edge tier - NPU agent
   */
  private async executeEdgeTier(scenario: StudioScenario, mcpResult: TierResult | null): Promise<TierResult> {
    const tierStart = Date.now();

    this.emitActivity('edge', 'edge_routing', 'Routing to NPU agent (Foundry Local)');

    const settings = settingsStore.getAll();
    const npuUrl = settings.npu_agent_url || 'http://localhost:8000';

    try {
      const npuClient = NPUAgentClient.createWithUrl(npuUrl);

      // Check health first
      const health = await npuClient.healthCheck();
      if (health.status !== 'healthy') {
        this.emitActivity('edge', 'edge_unavailable', 'NPU agent unavailable - escalating to cloud');
        return {
          active: false,
          latency_ms: Date.now() - tierStart,
          tokens_input: 0,
          tokens_output: 0,
          cost_usd: 0,
          response: 'NPU agent unavailable',
          confidence: 0,
          decision: 'escalate',
        };
      }

      this.emitActivity('edge', 'edge_inference', 'NPU inference started', {
        model: 'phi-3.5-mini-instruct',
        has_mcp_context: mcpResult !== null,
      });

      // Build incident from scenario
      const incident: Incident = {
        id: scenario.id,
        summary: scenario.summary,
        description: this.buildEdgeDescription(scenario, mcpResult),
        priority: scenario.priority,
        status: 'open',
        user: { email: 'demo@example.com', name: 'Demo User' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const npuResult = await npuClient.resolveIncident(incident);
      const latency = Date.now() - tierStart;

      this.emitActivity('edge', 'edge_result', `NPU resolution generated (confidence: ${(npuResult.confidence * 100).toFixed(0)}%)`, {
        confidence: npuResult.confidence,
        should_escalate: npuResult.should_escalate,
      });

      const tokensInput = npuResult.tokens_input || estimateTokens(incident.description);
      const tokensOutput = npuResult.tokens_output || estimateTokens(npuResult.resolution);

      return {
        active: true,
        latency_ms: latency,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost_usd: 0, // Local model, no cost
        response: npuResult.resolution,
        confidence: npuResult.confidence,
        decision: npuResult.should_escalate || npuResult.confidence < CONFIDENCE_THRESHOLD ? 'escalate' : 'resolve',
        model: 'phi-3.5-mini-instruct',
        raw_data: {
          reasoning: npuResult.reasoning,
          similar_incidents: npuResult.similar_incidents,
        },
      };
    } catch (error) {
      this.emitActivity('edge', 'edge_error', `NPU tier error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        active: true,
        latency_ms: Date.now() - tierStart,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        response: error instanceof Error ? error.message : 'NPU tier failed',
        confidence: 0,
        decision: 'escalate',
      };
    }
  }

  /**
   * Execute Cloud tier - Azure/OpenAI
   */
  private async executeCloudTier(scenario: StudioScenario, edgeResult: TierResult | null): Promise<TierResult> {
    const tierStart = Date.now();

    this.emitActivity('cloud', 'cloud_routing', 'Escalating to cloud agent (Azure AI Foundry)');

    const settings = settingsStore.getAll();

    if (!settings.cloud_api_key) {
      this.emitActivity('cloud', 'cloud_not_configured', 'Cloud API not configured');
      return {
        active: false,
        latency_ms: Date.now() - tierStart,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        response: 'Cloud API not configured. Please configure API key in settings.',
        confidence: 0,
        decision: 'error',
      };
    }

    try {
      const config: CloudAgentConfig = {
        apiKey: settings.cloud_api_key,
        baseUrl: settings.cloud_base_url,
        model: settings.cloud_model,
        azureApiVersion: settings.azure_api_version,
      };

      const cloudAgent = GenericCloudAgent.createWithConfig(config);

      this.emitActivity('cloud', 'cloud_processing', 'Cloud agent analyzing incident', {
        model: settings.cloud_model,
        is_azure: settings.cloud_base_url.includes('.azure.com'),
      });

      const cloudResult = await cloudAgent.resolveEscalation({
        id: scenario.id,
        summary: scenario.summary,
        description: scenario.description,
        npuAttempt: edgeResult
          ? {
              resolution: edgeResult.response,
              confidence: edgeResult.confidence,
              reasoning: (edgeResult.raw_data?.reasoning as string) || 'Local NPU processing',
            }
          : undefined,
      });

      const latency = Date.now() - tierStart;

      const tokensInput = cloudResult.usage?.prompt_tokens || estimateTokens(scenario.description);
      const tokensOutput = cloudResult.usage?.completion_tokens || estimateTokens(cloudResult.resolution);
      const costUsd = calculateCost(settings.cloud_model, { input: tokensInput, output: tokensOutput });

      this.emitActivity('cloud', 'cloud_result', `Cloud resolution generated (confidence: ${(cloudResult.confidence * 100).toFixed(0)}%)`, {
        confidence: cloudResult.confidence,
        requires_specialist: cloudResult.requires_specialist,
        tokens_used: cloudResult.usage?.total_tokens,
        cost_usd: costUsd,
      });

      return {
        active: true,
        latency_ms: latency,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost_usd: costUsd,
        response: cloudResult.resolution,
        confidence: cloudResult.confidence,
        decision: cloudResult.requires_specialist ? 'escalate' : 'resolve',
        model: settings.cloud_model,
        raw_data: {
          reasoning: cloudResult.reasoning,
          category: cloudResult.category,
          estimated_time: cloudResult.estimated_time,
          specialist_notes: cloudResult.specialist_notes,
        },
      };
    } catch (error) {
      this.emitActivity('cloud', 'cloud_error', `Cloud tier error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      if (error instanceof CloudConfigurationError) {
        return {
          active: false,
          latency_ms: Date.now() - tierStart,
          tokens_input: 0,
          tokens_output: 0,
          cost_usd: 0,
          response: 'Cloud agent configuration error. Check API settings.',
          confidence: 0,
          decision: 'error',
        };
      }

      return {
        active: true,
        latency_ms: Date.now() - tierStart,
        tokens_input: 0,
        tokens_output: 0,
        cost_usd: 0,
        response: error instanceof Error ? error.message : 'Cloud tier failed',
        confidence: 0,
        decision: 'error',
      };
    }
  }

  /**
   * Finalize and aggregate results
   */
  private finalizeResult(result: StudioResult, scenario: StudioScenario): StudioResult {
    // Calculate totals
    const tiers = [result.tiers.mcp, result.tiers.edge, result.tiers.cloud].filter((t) => t !== null);

    result.total_latency_ms = tiers.reduce((sum, t) => sum + (t?.latency_ms || 0), 0);
    result.total_tokens = {
      input: tiers.reduce((sum, t) => sum + (t?.tokens_input || 0), 0),
      output: tiers.reduce((sum, t) => sum + (t?.tokens_output || 0), 0),
    };
    result.total_cost_usd = tiers.reduce((sum, t) => sum + (t?.cost_usd || 0), 0);

    // Generate ticket output
    result.ticket_output = this.generateTicketOutput(result, scenario);

    // Attach timeline
    result.timeline = [...this.timeline];

    // Emit completion
    this.emitActivity('system', 'scenario_completed', `Scenario completed via ${result.final_tier} tier`, {
      success: result.success,
      total_latency_ms: result.total_latency_ms,
      total_cost_usd: result.total_cost_usd,
    });

    // Record metrics in database
    this.recordMetrics(result);

    return result;
  }

  /**
   * Generate HaloPSA-style ticket output
   */
  private generateTicketOutput(result: StudioResult, scenario: StudioScenario): string {
    const timestamp = new Date().toISOString();
    const ticketId = `INC-${Math.floor(Math.random() * 90000) + 10000}`;

    return `
================================================================================
INCIDENT TICKET: ${ticketId}
================================================================================
Status: ${result.success ? 'RESOLVED' : 'ESCALATED'}
Created: ${timestamp}
Priority: ${scenario.priority.toUpperCase()}
Category: ${scenario.category === 'windows' ? 'Windows IT' : 'Service Desk'}

ISSUE DESCRIPTION:
${scenario.summary}

${scenario.description}

--------------------------------------------------------------------------------
RESOLUTION DETAILS
--------------------------------------------------------------------------------
Resolved By: ${result.final_tier.toUpperCase()} Agent
Confidence: ${this.getFinalConfidence(result)}%
Processing Time: ${result.total_latency_ms}ms

RESOLUTION:
${result.resolution}

--------------------------------------------------------------------------------
PROCESSING METRICS
--------------------------------------------------------------------------------
${result.tiers.mcp?.active ? `MCP Tier: ${result.tiers.mcp.latency_ms}ms (Tool: ${result.tiers.mcp.tool_used})` : 'MCP Tier: Skipped'}
${result.tiers.edge?.active ? `Edge Tier: ${result.tiers.edge.latency_ms}ms (Tokens: ${result.tiers.edge.tokens_input + result.tiers.edge.tokens_output})` : 'Edge Tier: Skipped'}
${result.tiers.cloud?.active ? `Cloud Tier: ${result.tiers.cloud.latency_ms}ms (Tokens: ${result.tiers.cloud.tokens_input + result.tiers.cloud.tokens_output}, Cost: $${result.tiers.cloud.cost_usd.toFixed(4)})` : 'Cloud Tier: Skipped'}

Total Tokens: ${result.total_tokens.input + result.total_tokens.output}
Total Cost: $${result.total_cost_usd.toFixed(4)}
================================================================================
    `.trim();
  }

  /**
   * Get final confidence from the resolving tier
   */
  private getFinalConfidence(result: StudioResult): number {
    const tier = result.tiers[result.final_tier];
    return Math.round((tier?.confidence || 0) * 100);
  }

  /**
   * Format MCP tool result as human-readable response
   */
  private formatMCPResult(toolName: string, result: Record<string, unknown>): string {
    const lines = [`MCP Tool: ${toolName}`, '---'];

    for (const [key, value] of Object.entries(result)) {
      if (key === 'raw_data') continue;
      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`${formattedKey}: ${JSON.stringify(value)}`);
    }

    return lines.join('\n');
  }

  /**
   * Build edge description with MCP context
   */
  private buildEdgeDescription(scenario: StudioScenario, mcpResult: TierResult | null): string {
    let description = scenario.description;

    if (mcpResult?.raw_data) {
      description += `\n\n--- System Data from MCP ---\n${JSON.stringify(mcpResult.raw_data, null, 2)}`;
    }

    return description;
  }

  /**
   * Emit activity event
   */
  private emitActivity(
    tier: 'mcp' | 'edge' | 'cloud' | 'system',
    eventType: string,
    description: string,
    metadata?: Record<string, unknown>
  ): void {
    const event: StudioActivityEvent = {
      timestamp: Date.now() - this.startTime,
      tier,
      eventType,
      description,
      metadata,
    };

    this.timeline.push(event);
    this.emit('activity', event);
  }

  /**
   * Record metrics in database
   */
  private recordMetrics(result: StudioResult): void {
    const tiers: Array<{ key: 'mcp' | 'edge' | 'cloud'; data: TierResult | null }> = [
      { key: 'mcp', data: result.tiers.mcp },
      { key: 'edge', data: result.tiers.edge },
      { key: 'cloud', data: result.tiers.cloud },
    ];

    for (const { key, data } of tiers) {
      if (data?.active) {
        this.db.createMetric({
          session_id: result.session_id,
          scenario_id: result.scenario_id,
          tier: key,
          latency_ms: data.latency_ms,
          tokens_input: data.tokens_input,
          tokens_output: data.tokens_output,
          cost_usd: data.cost_usd,
        });
      }
    }
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}
