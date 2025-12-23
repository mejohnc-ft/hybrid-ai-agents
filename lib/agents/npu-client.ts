import { z } from 'zod';
import { NPUResolutionResult } from '../types';

const ResolutionResultSchema = z.object({
  confidence: z.number().min(0).max(1),
  resolution: z.string(),
  reasoning: z.string(),
  similar_incidents: z.array(z.string()),
  should_escalate: z.boolean(),
  escalation_reason: z.string().optional(),
});

export class NPUAgentClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.NPU_AGENT_URL || 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Resolve an incident using the local NPU agent
   */
  async resolveIncident(incident: {
    id: string;
    summary: string;
    description: string;
    category?: string;
    user: {
      email: string;
      name: string;
    };
    metadata?: Record<string, unknown>;
  }): Promise<NPUResolutionResult> {
    try {
      const response = await fetch(`${this.baseUrl}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`NPU Agent error: ${response.statusText} - ${error}`);
      }

      const data = await response.json();
      return ResolutionResultSchema.parse(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to resolve incident with NPU agent: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if the NPU agent service is healthy and available
   */
  async healthCheck(): Promise<{
    status: string;
    model_loaded: boolean;
    vector_db_ready: boolean;
    kb_entries: number;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`NPU agent service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a new resolution to the knowledge base
   */
  async addKnowledgeEntry(entry: {
    incident_summary: string;
    resolution: string;
    category: string;
    confidence: number;
  }): Promise<{ success: boolean; id: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/kb/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`Failed to add KB entry: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to add knowledge entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance for use across the app
export const npuAgent = new NPUAgentClient();
