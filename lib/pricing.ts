// Model pricing configuration (per 1 million tokens)
// Prices as of December 2024

export interface ModelPricing {
  input: number; // Cost per 1M input tokens
  output: number; // Cost per 1M output tokens
}

export interface TokenUsage {
  input: number;
  output: number;
}

// Pricing data for various models
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'o1': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },

  // Azure OpenAI (same pricing as OpenAI)
  'gpt-4o-azure': { input: 2.50, output: 10.00 },
  'gpt-4o-mini-azure': { input: 0.15, output: 0.60 },

  // Anthropic Models (via API)
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3.5-sonnet': { input: 3.00, output: 15.00 },

  // Local Models (no cost)
  'phi-3.5-mini': { input: 0, output: 0 },
  'phi-3.5-mini-instruct': { input: 0, output: 0 },
  'phi-3-mini': { input: 0, output: 0 },
  'llama-3.2': { input: 0, output: 0 },
  'mistral-7b': { input: 0, output: 0 },

  // Default fallback
  'default': { input: 2.50, output: 10.00 },
};

/**
 * Get pricing for a model, with fallback to default
 */
export function getModelPricing(model: string): ModelPricing {
  // Normalize model name (lowercase, remove version suffixes for matching)
  const normalizedModel = model.toLowerCase();

  // Try exact match first
  if (MODEL_PRICING[normalizedModel]) {
    return MODEL_PRICING[normalizedModel];
  }

  // Try prefix matching for versioned models
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (normalizedModel.startsWith(key) || key.startsWith(normalizedModel)) {
      return pricing;
    }
  }

  // Check if it's a local/edge model (typically free)
  const localModelPatterns = ['phi', 'llama', 'mistral', 'gemma', 'qwen', 'onnx'];
  if (localModelPatterns.some((pattern) => normalizedModel.includes(pattern))) {
    return { input: 0, output: 0 };
  }

  // Default pricing for unknown cloud models
  return MODEL_PRICING['default'];
}

/**
 * Calculate cost for a given token usage
 */
export function calculateCost(model: string, usage: TokenUsage): number {
  const pricing = getModelPricing(model);

  const inputCost = (usage.input / 1_000_000) * pricing.input;
  const outputCost = (usage.output / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost === 0) {
    return '$0.00';
  }
  if (cost < 0.0001) {
    return `$${cost.toFixed(6)}`;
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Estimate tokens from text (rough approximation)
 * ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Check if a model is a local/edge model (free)
 */
export function isLocalModel(model: string): boolean {
  const pricing = getModelPricing(model);
  return pricing.input === 0 && pricing.output === 0;
}

/**
 * Get a summary of session costs
 */
export interface SessionCostSummary {
  totalCost: number;
  cloudCost: number;
  edgeCost: number;
  cloudTokens: TokenUsage;
  edgeTokens: TokenUsage;
  byModel: Record<string, { tokens: TokenUsage; cost: number }>;
}

export function calculateSessionSummary(
  entries: Array<{ model: string; usage: TokenUsage }>
): SessionCostSummary {
  const summary: SessionCostSummary = {
    totalCost: 0,
    cloudCost: 0,
    edgeCost: 0,
    cloudTokens: { input: 0, output: 0 },
    edgeTokens: { input: 0, output: 0 },
    byModel: {},
  };

  for (const entry of entries) {
    const cost = calculateCost(entry.model, entry.usage);
    const isLocal = isLocalModel(entry.model);

    summary.totalCost += cost;

    if (isLocal) {
      summary.edgeCost += cost;
      summary.edgeTokens.input += entry.usage.input;
      summary.edgeTokens.output += entry.usage.output;
    } else {
      summary.cloudCost += cost;
      summary.cloudTokens.input += entry.usage.input;
      summary.cloudTokens.output += entry.usage.output;
    }

    if (!summary.byModel[entry.model]) {
      summary.byModel[entry.model] = { tokens: { input: 0, output: 0 }, cost: 0 };
    }
    summary.byModel[entry.model].tokens.input += entry.usage.input;
    summary.byModel[entry.model].tokens.output += entry.usage.output;
    summary.byModel[entry.model].cost += cost;
  }

  return summary;
}
