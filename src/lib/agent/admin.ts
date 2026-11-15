import "server-only";
import { getAdminContext } from "@/lib/admin/access";
import { UNLIMITED_MICROS } from "@/lib/agent/usage";

export type AgentUsageTotals = {
  micros: number;
  calls: number;
  promptTokens: number;
  completionTokens: number;
};

export type AgentSellerUsage = {
  userId: string;
  email: string | null;
  fullName: string | null;
  monthMicros: number;
  totalMicros: number;
  monthCalls: number;
  totalCalls: number;
  lastUsedAt: string | null;
  limitMicros: number;
  limitOverridden: boolean;
};

export type AgentModelUsage = { model: string; calls: number; micros: number };

/** Both draft paths use the same model, so operation is what separates them. */
export type AgentOperationUsage = {
  operation: string;
  calls: number;
  micros: number;
  monthCalls: number;
  monthMicros: number;
};

export type AgentLimitOverride = {
  userId: string;
  email: string | null;
  fullName: string | null;
  limitMicros: number;
  updatedAt: string;
};

export type AgentUsageDashboard = {
  defaultLimitMicros: number;
  monthStart: string;
  month: AgentUsageTotals;
  total: AgentUsageTotals;
  byModel: AgentModelUsage[];
  byOperation: AgentOperationUsage[];
  sellers: AgentSellerUsage[];
  overrides: AgentLimitOverride[];
};

export const MAX_AGENT_LIMIT_MICROS = 1_000_000_000;

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function totals(raw: unknown): AgentUsageTotals {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    micros: count(source.micros),
    calls: count(source.calls),
    promptTokens: count(source.prompt_tokens),
    completionTokens: count(source.completion_tokens),
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export const EMPTY_AGENT_DASHBOARD: AgentUsageDashboard = {
  defaultLimitMicros: 0,
  monthStart: new Date().toISOString(),
  month: { micros: 0, calls: 0, promptTokens: 0, completionTokens: 0 },
  total: { micros: 0, calls: 0, promptTokens: 0, completionTokens: 0 },
  byModel: [],
  byOperation: [],
  sellers: [],
  overrides: [],
};

export async function getAgentUsageDashboard(): Promise<AgentUsageDashboard> {
  const { admin, user } = await getAdminContext();
  const { data, error } = await admin.rpc("agent_usage_dashboard", {
    p_actor: user.id,
    p_limit: 100,
  });
  if (error) throw new Error("Agent usage data is unavailable");
  const payload = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;

  return {
    defaultLimitMicros: count(payload.default_limit_micros),
    monthStart: text(payload.month_start) ?? new Date().toISOString(),
    month: totals(payload.month),
    total: totals(payload.total),
    byModel: (Array.isArray(payload.by_model) ? payload.by_model : []).map((entry) => {
      const row = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      return {
        model: text(row.model) ?? "unknown",
        calls: count(row.calls),
        micros: count(row.micros),
      };
    }),
    byOperation: (Array.isArray(payload.by_operation) ? payload.by_operation : []).map((entry) => {
      const row = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      return {
        operation: text(row.operation) ?? "unknown",
        calls: count(row.calls),
        micros: count(row.micros),
        monthCalls: count(row.month_calls),
        monthMicros: count(row.month_micros),
      };
    }),
    sellers: (Array.isArray(payload.sellers) ? payload.sellers : []).map((entry) => {
      const row = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      return {
        userId: text(row.user_id) ?? "",
        email: text(row.email),
        fullName: text(row.full_name),
        monthMicros: count(row.month_micros),
        totalMicros: count(row.total_micros),
        monthCalls: count(row.month_calls),
        totalCalls: count(row.total_calls),
        lastUsedAt: text(row.last_used_at),
        limitMicros: count(row.limit_micros),
        limitOverridden: row.limit_overridden === true,
      };
    }),
    overrides: (Array.isArray(payload.overrides) ? payload.overrides : []).map((entry) => {
      const row = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      return {
        userId: text(row.user_id) ?? "",
        email: text(row.email),
        fullName: text(row.full_name),
        limitMicros: count(row.limit_micros),
        updatedAt: text(row.updated_at) ?? "",
      };
    }),
  };
}

export type AgentAdminAction =
  | { action: "agent-limit"; userId: string; limitMicros: number | null }
  | { action: "agent-default-limit"; limitMicros: number };

function limitMicros(value: unknown, allowUnlimited: boolean): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) throw new AgentAdminInputError("กรุณากรอกโควตาเป็นตัวเลข");
  const min = allowUnlimited ? UNLIMITED_MICROS : 0;
  if (parsed < min || parsed > MAX_AGENT_LIMIT_MICROS) {
    throw new AgentAdminInputError("โควตาอยู่นอกช่วงที่รองรับ");
  }
  return parsed;
}

export class AgentAdminInputError extends Error {
  readonly status = 400;
}

export function parseAgentAdminAction(action: string, raw: unknown): AgentAdminAction {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AgentAdminInputError("Invalid request");
  }
  const body = raw as Record<string, unknown>;
  if (action === "agent-limit") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ) {
      throw new AgentAdminInputError("Invalid record ID");
    }
    return {
      action,
      userId,
      // null clears the override so the platform default applies again.
      limitMicros: body.limitMicros === null ? null : limitMicros(body.limitMicros, true),
    };
  }
  if (action === "agent-default-limit") {
    return { action, limitMicros: limitMicros(body.limitMicros, false) };
  }
  throw new AgentAdminInputError("Unknown admin action");
}

export async function applyAgentAdminAction(action: string, body: unknown) {
  const { admin, user } = await getAdminContext();
  const input = parseAgentAdminAction(action, body);
  const { error } =
    input.action === "agent-limit"
      ? await admin.rpc("admin_set_agent_limit", {
          p_actor: user.id,
          p_user: input.userId,
          p_limit: input.limitMicros,
        })
      : await admin.rpc("admin_set_agent_default_limit", {
          p_actor: user.id,
          p_limit: input.limitMicros,
        });
  if (error) throw new Error("บันทึกโควตาไม่สำเร็จ กรุณาลองอีกครั้ง");
  return input.action;
}
