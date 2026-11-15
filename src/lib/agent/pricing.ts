/**
 * DeepSeek list prices, USD per 1,000,000 tokens, as published at
 * https://api-docs.deepseek.com/quick_start/pricing (checked 2026-11-15).
 *
 * Costs are stored as micro-USD integers (1_000_000 micros = 1 USD), so a
 * USD-per-million rate is also the micro-USD cost of a single token.
 */
export type AgentModelId = "deepseek-flash" | "deepseek-v4-pro";

export type ModelRates = {
  cacheHitInput: number;
  cacheMissInput: number;
  output: number;
};

export type ModelPricing = {
  id: AgentModelId;
  label: string;
  peak: ModelRates;
};

export const AGENT_MODELS: Record<AgentModelId, ModelPricing> = {
  "deepseek-flash": {
    id: "deepseek-flash",
    label: "DeepSeek V4.1 Flash",
    peak: { cacheHitInput: 0.006, cacheMissInput: 0.3, output: 1.2 },
  },
  "deepseek-v4-pro": {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    peak: { cacheHitInput: 0.044, cacheMissInput: 1.32, output: 3.96 },
  },
};

/** The cheapest model DeepSeek offers; every product draft runs on it. */
export const DEFAULT_AGENT_MODEL: AgentModelId = "deepseek-flash";

export function isAgentModelId(value: unknown): value is AgentModelId {
  return typeof value === "string" && value in AGENT_MODELS;
}

/**
 * Peak is 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday. DeepSeek also
 * treats Chinese public holidays as off-peak; those are not modelled, so a
 * holiday request is costed at the peak rate and never under-counted.
 */
export function isPeakPricing(at: Date): boolean {
  const day = at.getUTCDay();
  if (day === 0 || day === 6) return false;
  const hour = at.getUTCHours();
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
}

export function modelRates(model: AgentModelId, at: Date): ModelRates {
  const { peak } = AGENT_MODELS[model];
  if (isPeakPricing(at)) return peak;
  return {
    cacheHitInput: peak.cacheHitInput / 2,
    cacheMissInput: peak.cacheMissInput / 2,
    output: peak.output / 2,
  };
}

export type TokenUsage = {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
};

export function normalizeTokenUsage(raw: unknown): TokenUsage {
  const usage = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const details = (
    usage.prompt_tokens_details && typeof usage.prompt_tokens_details === "object"
      ? usage.prompt_tokens_details
      : {}
  ) as Record<string, unknown>;
  const count = (value: unknown) => {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const promptTokens = count(usage.prompt_tokens);
  const cachedTokens = Math.min(
    promptTokens,
    count(usage.prompt_cache_hit_tokens) || count(details.cached_tokens),
  );
  return {
    promptTokens,
    cachedTokens,
    completionTokens: count(usage.completion_tokens),
  };
}

/** Cost of one call in micro-USD, rounded up so a tiny call is never free. */
export function usageCostMicros(
  model: AgentModelId,
  usage: TokenUsage,
  at: Date,
): number {
  const rates = modelRates(model, at);
  const missTokens = Math.max(0, usage.promptTokens - usage.cachedTokens);
  const exact =
    usage.cachedTokens * rates.cacheHitInput +
    missTokens * rates.cacheMissInput +
    usage.completionTokens * rates.output;
  return exact > 0 ? Math.max(1, Math.ceil(exact)) : 0;
}

export function formatUsd(micros: number): string {
  const usd = micros / 1_000_000;
  if (usd === 0) return "0.0000 USD";
  if (usd < 0.01) return `${usd.toFixed(4)} USD`;
  return `${usd.toFixed(2)} USD`;
}
