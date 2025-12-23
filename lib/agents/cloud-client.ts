import OpenAI from 'openai';

export interface CloudEscalationRequest {
  id: string;
  summary: string;
  description: string;
  npuAttempt?: {
    resolution: string;
    confidence: number;
    reasoning: string;
  };
}

export interface CloudResolutionResult {
  resolution: string;
  reasoning: string;
  confidence: number;
  category: string;
  estimated_time: string;
  requires_specialist: boolean;
  specialist_notes?: string;
}

export class GenericCloudAgent {
  private client: OpenAI;
  private model: string;
  private systemPrompt: string;

  constructor() {
    // Support any OpenAI-compatible API
    const apiKey = process.env.CLOUD_AI_API_KEY;
    const baseURL = process.env.CLOUD_AI_BASE_URL;

    if (!apiKey) {
      throw new Error('CLOUD_AI_API_KEY environment variable is required');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1',
    });

    this.model = process.env.CLOUD_AI_MODEL || 'gpt-4o';
    this.systemPrompt = this.buildSystemPrompt();
  }

  private buildSystemPrompt(): string {
    return `You are a senior technical support specialist working with an edge-to-cloud AI service desk system.

CONTEXT:
- You receive incidents that have been escalated from a local NPU-powered AI agent (Tier 1 agent)
- The NPU agent attempted to resolve the incident but had low confidence (<70%)
- You have access to the NPU agent's attempted resolution, reasoning, and confidence score
- The local agent uses a smaller model (Phi-3.5, 3.8B parameters) running on device NPU hardware
- You are the expert fallback with access to more compute and knowledge

YOUR ROLE:
- Analyze complex technical incidents (Tier 2+ incidents)
- Provide detailed, step-by-step resolutions that are actionable
- Be specific and thorough - these resolutions go into service desk tickets
- Consider the NPU agent's attempt and explain why your approach is better or more complete
- Assess whether the issue genuinely requires human specialist intervention
- Generate resolutions suitable for direct inclusion in ticketing systems

OUTPUT FORMAT:
Respond with a JSON object in this exact format:
{
  "resolution": "Detailed step-by-step resolution (use numbered list format, be specific and actionable)",
  "reasoning": "Why this resolution is appropriate and how it improves on or differs from the NPU agent's attempt. Explain your confidence level.",
  "confidence": 0.75,
  "category": "Network|Security|Application|Hardware|Access|Email|Other",
  "estimated_time": "Realistic time estimate for resolution (e.g., '15-30 minutes', '1-2 hours')",
  "requires_specialist": false,
  "specialist_notes": "Only if requires_specialist is true - explain what specialist expertise is needed and why"
}

CONFIDENCE SCORING GUIDELINES:
- 0.90-1.00: High confidence - clear diagnosis and proven resolution steps
- 0.75-0.89: Good confidence - likely resolution based on similar patterns
- 0.70-0.74: Acceptable confidence - reasonable approach but some uncertainty
- <0.70: DO NOT use - if you can't reach 70% confidence, set requires_specialist to true

REQUIRES_SPECIALIST CRITERIA:
Only set requires_specialist to true if ANY of these apply:
- Issue requires physical hardware access or on-site presence
- Security incident requiring forensic analysis or legal involvement
- Critical system failure affecting production infrastructure
- Requires vendor-specific expertise or support escalation
- Involves compliance/regulatory requirements
- Your confidence is below 70%

IMPORTANT GUIDELINES:
- Be concise but thorough - aim for 3-8 resolution steps
- Use specific commands, URLs, or configuration values when applicable
- If the NPU agent was on the right track, acknowledge it and build on their attempt
- If the NPU agent missed something critical, explain what and why
- Focus on resolution, not just diagnosis
- Assume the end user is technical but may not be an expert in this specific area`;
  }

  async resolveEscalation(incident: CloudEscalationRequest): Promise<CloudResolutionResult> {
    const userPrompt = this.buildUserPrompt(incident);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent, focused responses
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from cloud agent');
      }

      const result = JSON.parse(content) as CloudResolutionResult;

      // Validate confidence is in acceptable range
      if (result.confidence < 0.7 && !result.requires_specialist) {
        result.requires_specialist = true;
        result.specialist_notes = result.specialist_notes || 'Confidence below 70% threshold - requires human review';
      }

      return result;
    } catch (error) {
      console.error('Cloud agent error:', error);
      throw new Error(`Cloud agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildUserPrompt(incident: CloudEscalationRequest): string {
    let prompt = `INCIDENT SUMMARY: ${incident.summary}

DETAILED DESCRIPTION:
${incident.description}`;

    if (incident.npuAttempt) {
      prompt += `\n\n--- NPU AGENT ATTEMPTED RESOLUTION ---
Confidence Score: ${(incident.npuAttempt.confidence * 100).toFixed(1)}%

NPU Agent's Reasoning:
${incident.npuAttempt.reasoning}

NPU Agent's Proposed Resolution:
${incident.npuAttempt.resolution}

--- END NPU ATTEMPT ---

The NPU agent escalated this incident because its confidence was below the 70% threshold.
Please analyze the incident, review the NPU agent's attempt, and provide a comprehensive resolution.`;
    } else {
      prompt += `\n\nThis incident was routed directly to you without a local NPU attempt.`;
    }

    prompt += `\n\nPlease provide a detailed resolution for this incident in the required JSON format.`;

    return prompt;
  }

  async streamResolve(
    incident: CloudEscalationRequest,
    onChunk: (text: string) => void
  ): Promise<void> {
    const userPrompt = this.buildUserPrompt(incident);

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onChunk(content);
        }
      }
    } catch (error) {
      console.error('Cloud agent streaming error:', error);
      throw new Error(`Cloud agent streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      // Simple health check - attempt a minimal API call
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Respond with OK' }],
        max_tokens: 5,
      });

      if (response.choices[0]?.message?.content) {
        return {
          status: 'healthy',
          message: `Cloud agent is healthy (model: ${this.model})`,
        };
      }

      return {
        status: 'unhealthy',
        message: 'No response from cloud agent',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Cloud agent health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// Singleton instance
let cloudAgentInstance: GenericCloudAgent | null = null;

export function getCloudAgent(): GenericCloudAgent {
  if (!cloudAgentInstance) {
    cloudAgentInstance = new GenericCloudAgent();
  }
  return cloudAgentInstance;
}
