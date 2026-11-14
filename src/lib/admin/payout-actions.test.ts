import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), reconcile: vi.fn(), prepare: vi.fn(), cancel: vi.fn(), complete: vi.fn(), instructions: vi.fn() }));
vi.mock("./access", () => ({ getAdminContext: m.auth }));
vi.mock("@/lib/payouts/service", () => ({ reconcilePayouts: m.reconcile, preparePayoutBatch: m.prepare, cancelPayoutBatch: m.cancel, completeManualPayout: m.complete, getPayoutBatchInstructions: m.instructions, getManualPayoutRecord: m.instructions }));
import { applyPayoutAction } from "./payout-actions";
const batchId = "b598875b-3672-4af8-8aa0-a121617aa321";
const paidAt = "2026-11-14T03:00:00.000Z";
beforeEach(() => { vi.resetAllMocks(); m.auth.mockResolvedValue({ user: { id: "verified-admin" } }); m.instructions.mockResolvedValue({ amountCents: 950 }); });
it("authorizes before reading financial information", async () => {
  m.auth.mockRejectedValue(new Error("Forbidden"));
  await expect(applyPayoutAction("payout-instructions", { batchId })).rejects.toThrow("Forbidden");
  expect(m.instructions).not.toHaveBeenCalled();
});
it("never uses a caller-supplied admin actor", async () => {
  m.prepare.mockResolvedValue({ batchIds: [batchId] });
  expect(await applyPayoutAction("payout-prepare", { requestId: batchId, actorId: "imposter" })).toEqual({ batchIds: [batchId] });
  expect(m.prepare).toHaveBeenCalledWith("verified-admin", batchId);
});
it("requires confirmation and exact server amount before recording payment", async () => {
  const body = { batchId, reference: "BANK12345", paidAt, amountCents: 950, confirmed: true };
  await expect(applyPayoutAction("payout-complete", { ...body, confirmed: false })).rejects.toThrow();
  await expect(applyPayoutAction("payout-complete", { ...body, amountCents: 1000 })).rejects.toThrow();
  expect(m.complete).not.toHaveBeenCalled();
  await applyPayoutAction("payout-complete", body);
  expect(m.complete).toHaveBeenCalledWith("verified-admin", batchId, "BANK12345", paidAt);
});
it("rejects invalid IDs, future dates and deferred automatic scheduling", async () => {
  await expect(applyPayoutAction("payout-cancel", { batchId: "bad" })).rejects.toThrow();
  await expect(applyPayoutAction("payout-complete", { batchId, reference: "BANK123", paidAt: "2999-01-01T00:00:00Z", amountCents: 950, confirmed: true })).rejects.toThrow();
  await expect(applyPayoutAction("payout-settings", { mode: "automatic" })).rejects.toThrow();
  expect(m.cancel).not.toHaveBeenCalled();
  expect(m.complete).not.toHaveBeenCalled();
});
it("requires an explicit no-transfer attestation before releasing reserved orders", async () => {
  await expect(applyPayoutAction("payout-cancel", { batchId })).rejects.toThrow();
  expect(m.cancel).not.toHaveBeenCalled();
  await applyPayoutAction("payout-cancel", { batchId, confirmedNotTransferred: true });
  expect(m.cancel).toHaveBeenCalledWith("verified-admin", batchId);
});
