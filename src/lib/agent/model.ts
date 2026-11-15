import type { AgentModelId } from "@/lib/agent/pricing";

/** Everything the agent proposes. The seller confirms it before it is used. */
export type ProductDraft = {
  name: string;
  price: string;
  comparePrice: string;
  descriptionHtml: string;
  highlights: string[];
  faq: { id: string; question: string; answer: string }[];
  imageAlt: string;
  notes: string;
};

export type AgentCallUsage = {
  model: AgentModelId;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costMicros: number;
};

export type AgentAllowance = {
  limitMicros: number;
  usedMicros: number;
  remainingMicros: number;
};

export type ProductDraftResponse = {
  draft: ProductDraft;
  usage: AgentCallUsage;
  allowance: AgentAllowance;
  pagesRead: number;
  /** "ocr" when the words were read off page images rather than a text layer. */
  textSource: "layer" | "ocr";
};

/** Recorded per call, so the admin page shows which path is spending the quota. */
export const AGENT_OPERATIONS = ["product-draft", "product-draft-ocr"] as const;
export type AgentOperation = (typeof AGENT_OPERATIONS)[number];

/** Platform default when an admin has not set a per-seller limit. */
export const DEFAULT_MONTHLY_LIMIT_MICROS = 300_000;
