import { EventEmitter } from 'events';
import { getDemoDB, DemoIncident } from '../demo-db';
import { npuAgent } from '../agents/npu-client';
import { getCloudAgent } from '../agents/cloud-client';
import type { Incident } from '../types';

export interface ActivityEvent {
  incidentId: string;
  timestamp: number;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface RoutingDecision {
  route: 'npu' | 'cloud';
  reasoning: string;
  confidence: number;
}

export interface ResolutionResult {
  success: boolean;
  agent: 'npu' | 'cloud';
  resolution: string;
  confidence: number;
  latency: number;
  escalated?: boolean;
  escalationReason?: string;
}

// T1 keywords that suggest NPU can handle
const T1_KEYWORDS = [
  'password',
  'reset',
  'locked',
  'account',
  'license',
  'activation',
  'printer',
  'email',
  'outlook',
  'login',
  'access',
  'forgot',
];

// T2+ keywords that suggest cloud escalation
const T2_KEYWORDS = [
  'vpn',
  'network',
  'outage',
  'down',
  'security',
  'breach',
  'malware',
  'virus',
  'integration',
  'api',
  'server',
  'database',
  'critical',
  'emergency',
];

export class DemoDecisionEngine extends EventEmitter {
  private db = getDemoDB();

  async routeIncident(incident: Incident): Promise<ResolutionResult> {
    const startTime = Date.now();

    // Create incident in demo database
    const demoIncident = this.db.createIncident({
      summary: incident.summary,
      description: incident.description,
      priority: incident.priority,
      status: 'open',
    });

    // Emit: Incident received
    this.emitActivity({
      incidentId: demoIncident.id,
      timestamp: Date.now() - startTime,
      eventType: 'incident_received',
      description: 'Incident received',
    });

    await this.sleep(100);

    // Make routing decision
    const decision = await this.makeRoutingDecision(incident);

    // Save routing decision
    this.db.createRoutingDecision({
      incident_id: demoIncident.id,
      route: decision.route,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
    });

    // Emit: Classification complete
    this.emitActivity({
      incidentId: demoIncident.id,
      timestamp: Date.now() - startTime,
      eventType: 'classified',
      description: `Classified as ${decision.route === 'npu' ? 'T1' : 'T2+'} incident`,
      metadata: { route: decision.route, reasoning: decision.reasoning },
    });

    // Route to appropriate agent
    if (decision.route === 'npu') {
      return await this.handleWithNPU(demoIncident, incident, startTime);
    } else {
      return await this.handleWithCloud(demoIncident, incident, startTime);
    }
  }

  private async makeRoutingDecision(incident: Incident): Promise<RoutingDecision> {
    const text = `${incident.summary} ${incident.description}`.toLowerCase();

    // Check for T2+ keywords first (higher priority)
    const hasT2Keywords = T2_KEYWORDS.some(keyword => text.includes(keyword));
    if (hasT2Keywords) {
      return {
        route: 'cloud',
        reasoning: 'Complex T2+ incident detected (network, security, or integration issue)',
        confidence: 0.8,
      };
    }

    // Check for critical priority override
    if (incident.priority === 'critical') {
      return {
        route: 'cloud',
        reasoning: 'Critical priority - routing to cloud for expert handling',
        confidence: 0.9,
      };
    }

    // Check for T1 keywords
    const hasT1Keywords = T1_KEYWORDS.some(keyword => text.includes(keyword));
    if (hasT1Keywords) {
      return {
        route: 'npu',
        reasoning: 'Standard T1 pattern detected (password, access, or license issue)',
        confidence: 0.75,
      };
    }

    // Default: try NPU first for unknown cases
    return {
      route: 'npu',
      reasoning: 'Unknown pattern - attempting local NPU resolution first',
      confidence: 0.6,
    };
  }

  private async handleWithNPU(
    demoIncident: DemoIncident,
    incident: Incident,
    startTime: number
  ): Promise<ResolutionResult> {
    // Emit: Routing to NPU
    this.emitActivity({
      incidentId: demoIncident.id,
      timestamp: Date.now() - startTime,
      eventType: 'routing',
      description: 'Routing to NPU agent (local)',
    });

    await this.sleep(200);

    try {
      // Check NPU health
      const health = await npuAgent.healthCheck();

      if (health.status !== 'healthy') {
        // NPU unavailable - escalate to cloud
        this.emitActivity({
          incidentId: demoIncident.id,
          timestamp: Date.now() - startTime,
          eventType: 'npu_unavailable',
          description: 'NPU agent unavailable - escalating to cloud',
        });

        this.db.updateIncidentStatus(demoIncident.id, 'escalated');

        return await this.handleWithCloud(demoIncident, incident, startTime, {
          npuAttempt: {
            resolution: '',
            confidence: 0,
            reasoning: 'NPU agent service unavailable',
          },
        });
      }

      // Emit: RAG search
      this.emitActivity({
        incidentId: demoIncident.id,
        timestamp: Date.now() - startTime,
        eventType: 'rag_search',
        description: 'Searching local knowledge base',
      });

      await this.sleep(300);

      // Attempt resolution with NPU
      this.emitActivity({
        incidentId: demoIncident.id,
        timestamp: Date.now() - startTime,
        eventType: 'npu_inference',
        description: 'NPU inference started',
      });

      const npuResult = await npuAgent.resolveIncident(incident);
      const npuLatency = Date.now() - startTime;

      // Emit: NPU result
      this.emitActivity({
        incidentId: demoIncident.id,
        timestamp: npuLatency,
        eventType: 'npu_result',
        description: `NPU resolution generated (confidence: ${(npuResult.confidence * 100).toFixed(0)}%)`,
        metadata: { confidence: npuResult.confidence },
      });

      // Check if NPU confidence is sufficient
      if (!npuResult.should_escalate && npuResult.confidence >= 0.7) {
        // NPU resolved successfully
        this.emitActivity({
          incidentId: demoIncident.id,
          timestamp: npuLatency,
          eventType: 'resolution_accepted',
          description: 'Resolution accepted (above 70% threshold)',
        });

        // Save resolution
        this.db.createResolution({
          incident_id: demoIncident.id,
          agent: 'npu',
          resolution: npuResult.resolution,
          confidence: npuResult.confidence,
          latency_ms: npuLatency,
        });

        this.db.updateIncidentStatus(demoIncident.id, 'resolved');

        this.emit('complete', demoIncident.id);

        return {
          success: true,
          agent: 'npu',
          resolution: npuResult.resolution,
          confidence: npuResult.confidence,
          latency: npuLatency,
        };
      } else {
        // NPU confidence too low - escalate to cloud
        this.emitActivity({
          incidentId: demoIncident.id,
          timestamp: npuLatency,
          eventType: 'escalation_triggered',
          description: `Escalating to cloud (confidence ${(npuResult.confidence * 100).toFixed(0)}% below 70% threshold)`,
        });

        this.db.updateIncidentStatus(demoIncident.id, 'escalated');

        return await this.handleWithCloud(demoIncident, incident, startTime, {
          npuAttempt: {
            resolution: npuResult.resolution,
            confidence: npuResult.confidence,
            reasoning: npuResult.escalation_reason || 'Confidence below threshold',
          },
        });
      }
    } catch (error) {
      console.error('NPU agent error:', error);

      this.emitActivity({
        incidentId: demoIncident.id,
        timestamp: Date.now() - startTime,
        eventType: 'npu_error',
        description: `NPU agent error - escalating to cloud`,
      });

      this.db.updateIncidentStatus(demoIncident.id, 'escalated');

      return await this.handleWithCloud(demoIncident, incident, startTime, {
        npuAttempt: {
          resolution: '',
          confidence: 0,
          reasoning: 'NPU agent encountered an error',
        },
      });
    }
  }

  private async handleWithCloud(
    demoIncident: DemoIncident,
    incident: Incident,
    startTime: number,
    escalationContext?: {
      npuAttempt: {
        resolution: string;
        confidence: number;
        reasoning: string;
      };
    }
  ): Promise<ResolutionResult> {
    // Emit: Routing to cloud
    this.emitActivity({
      incidentId: demoIncident.id,
      timestamp: Date.now() - startTime,
      eventType: 'cloud_routing',
      description: 'Escalating to cloud agent (Azure OpenAI)',
    });

    await this.sleep(500);

    try {
      const cloudAgent = getCloudAgent();

      // Emit: Cloud processing
      this.emitActivity({
        incidentId: demoIncident.id,
        timestamp: Date.now() - startTime,
        eventType: 'cloud_processing',
        description: 'Cloud agent analyzing incident',
      });

      const cloudResult = await cloudAgent.resolveEscalation({
        id: incident.id,
        summary: incident.summary,
        description: incident.description,
        npuAttempt: escalationContext?.npuAttempt,
      });

      const cloudLatency = Date.now() - startTime;

      // Emit: Cloud result
      this.emitActivity({
        incidentId: demoIncident.id,
        timestamp: cloudLatency,
        eventType: 'cloud_result',
        description: `Cloud resolution generated (confidence: ${(cloudResult.confidence * 100).toFixed(0)}%)`,
        metadata: {
          confidence: cloudResult.confidence,
          category: cloudResult.category,
          requires_specialist: cloudResult.requires_specialist,
        },
      });

      if (!cloudResult.requires_specialist) {
        // Cloud resolved successfully
        this.emitActivity({
          incidentId: demoIncident.id,
          timestamp: cloudLatency,
          eventType: 'resolution_accepted',
          description: 'Cloud resolution accepted',
        });

        // Save resolution
        this.db.createResolution({
          incident_id: demoIncident.id,
          agent: 'cloud',
          resolution: cloudResult.resolution,
          confidence: cloudResult.confidence,
          agent_chain: JSON.stringify({
            category: cloudResult.category,
            reasoning: cloudResult.reasoning,
            estimated_time: cloudResult.estimated_time,
          }),
          latency_ms: cloudLatency,
        });

        this.db.updateIncidentStatus(demoIncident.id, 'resolved');

        // Emit: Knowledge sync (future: sync back to NPU KB)
        this.emitActivity({
          incidentId: demoIncident.id,
          timestamp: cloudLatency + 100,
          eventType: 'kb_sync',
          description: 'Syncing resolution to local knowledge base for future T1 handling',
        });

        this.emit('complete', demoIncident.id);

        return {
          success: true,
          agent: 'cloud',
          resolution: cloudResult.resolution,
          confidence: cloudResult.confidence,
          latency: cloudLatency,
          escalated: !!escalationContext,
        };
      } else {
        // Requires human specialist
        this.emitActivity({
          incidentId: demoIncident.id,
          timestamp: cloudLatency,
          eventType: 'human_escalation',
          description: 'Requires human specialist intervention',
          metadata: { specialist_notes: cloudResult.specialist_notes },
        });

        this.db.updateIncidentStatus(demoIncident.id, 'escalated');

        this.emit('complete', demoIncident.id);

        return {
          success: false,
          agent: 'cloud',
          resolution: cloudResult.resolution,
          confidence: cloudResult.confidence,
          latency: cloudLatency,
          escalated: true,
          escalationReason: cloudResult.specialist_notes || 'Requires human specialist',
        };
      }
    } catch (error) {
      console.error('Cloud agent error:', error);

      this.emitActivity({
        incidentId: demoIncident.id,
        timestamp: Date.now() - startTime,
        eventType: 'cloud_error',
        description: `Cloud agent error - requires human intervention`,
      });

      this.db.updateIncidentStatus(demoIncident.id, 'escalated');

      this.emit('complete', demoIncident.id);

      return {
        success: false,
        agent: 'cloud',
        resolution: 'Cloud agent encountered an error. Manual intervention required.',
        confidence: 0,
        latency: Date.now() - startTime,
        escalated: true,
        escalationReason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private emitActivity(event: ActivityEvent): void {
    // Emit to listeners (for real-time UI updates)
    this.emit('activity', event);

    // Log to database
    this.db.logActivity({
      incident_id: event.incidentId,
      timestamp_ms: event.timestamp,
      event_type: event.eventType,
      description: event.description,
      metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getIncidentActivity(incidentId: string) {
    return this.db.getActivityLog(incidentId);
  }

  getIncidentDetails(incidentId: string) {
    return {
      incident: this.db.getIncident(incidentId),
      routing: this.db.getRoutingDecision(incidentId),
      resolution: this.db.getResolution(incidentId),
      activity: this.db.getActivityLog(incidentId),
    };
  }

  getAnalytics() {
    return this.db.getAnalytics();
  }
}
