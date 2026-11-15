import "server-only";
import type { AgentAllowance, AgentOperation } from "@/lib/agent/model";
import { formatUsd, type AgentModelId, type TokenUsage } from "@/lib/agent/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

export const UNLIMITED_MICROS = -1;

export function isUnlimited(limitMicros: number): boolean {
  return limitMicros === UNLIMITED_MICROS;
}

export function hasAllowance(allowance: AgentAllowance): boolean {
  return isUnlimited(allowance.limitMicros) || allowance.usedMicros < allowance.limitMicros;
}

function allowanceFrom(limitMicros: number, usedMicros: number): AgentAllowance {
  return {
    limitMicros,
    usedMicros,
    remainingMicros: isUnlimited(limitMicros)
      ? UNLIMITED_MICROS
      : Math.max(0, limitMicros - usedMicros),
  };
}

/** This calendar month's spend for one seller, against their ceiling. */
export async function readAllowance(userId: string): Promise<AgentAllowance> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("agent_usage_status", { p_user: userId });
  if (error) throw new Error("ตรวจสอบโควตา AI ไม่สำเร็จ");
  const row = Array.isArray(data) ? data[0] : data;
  return allowanceFrom(Number(row?.limit_micros ?? 0), Number(row?.used_micros ?? 0));
}

export async function recordUsage(options: {
  userId: string;
  operation: AgentOperation;
  model: AgentModelId;
  usage: TokenUsage;
  costMicros: number;
  limitMicros: number;
}): Promise<AgentAllowance> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("agent_record_usage", {
    p_user: options.userId,
    p_operation: options.operation,
    p_model: options.model,
    p_prompt_tokens: options.usage.promptTokens,
    p_cached_tokens: options.usage.cachedTokens,
    p_completion_tokens: options.usage.completionTokens,
    p_cost_micros: options.costMicros,
  });
  if (error) throw new Error("บันทึกการใช้งาน AI ไม่สำเร็จ");
  return allowanceFrom(options.limitMicros, Number(data ?? options.costMicros));
}

export function limitReachedMessage(allowance: AgentAllowance): string {
  if (allowance.limitMicros === 0) {
    return "บัญชีนี้ถูกปิดการใช้งาน AI ช่วยกรอกข้อมูล กรุณาติดต่อผู้ดูแลระบบ";
  }
  return `ใช้โควตา AI ของเดือนนี้ครบแล้ว (${formatUsd(allowance.usedMicros)} จาก ${formatUsd(
    allowance.limitMicros,
  )}) กรอกข้อมูลเองได้ตามปกติ หรือติดต่อผู้ดูแลระบบเพื่อขอเพิ่มโควตา`;
}
