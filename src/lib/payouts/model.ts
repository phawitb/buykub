export type PayoutMode = "manual" | "automatic";
export type PayoutBatchSummary = {
  completionWarning?: string | null; hasSlip: boolean; id: string; shopId: string; shopName: string; amountCents: number; orderCount: number;
  status: "ready" | "completed" | "cancelled" | "review_required";
  recipientName: string; destinationMasked: string; createdAt: string;
  paidAt: string | null; transferReference: string | null;
};
export type PayoutDashboard = {
  mode: PayoutMode; scheduleEnabled: boolean; providerReady: false; providerReason: string;
  scheduleLabel: string; lastReconciledAt: string | null;
  eligibleCents: number; eligibleOrderCount: number; blockedOrderCount: number;
  blockedReasons: { reason: string; count: number }[];
  batches: PayoutBatchSummary[];
};
export type PayoutInstructions = {
  batchId: string; shopName: string; amountCents: number; recipientName: string;
  method: "bank" | "promptpay"; bankCode: string | null; accountNumber: string | null;
  promptpayId: string | null; warning: string;
};
export const PROVIDER_REASON = "ยังไม่ได้เชื่อมต่อผู้ให้บริการโอนเงินเข้าธนาคาร: Stripe ประเทศไทยไม่รองรับการแยกยอดรับชำระเพื่อโอนให้ผู้ขาย ใช้โอนจริงด้วยตนเองและบันทึกหลักฐานได้";
