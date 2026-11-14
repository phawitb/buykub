import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({dashboard:vi.fn(),prepare:vi.fn()}));
vi.mock("@/lib/payouts/service",()=>({getPayoutDashboard:mocks.dashboard,preparePayoutBatch:mocks.prepare}));
import { GET } from "./route";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("CRON_SECRET","test-secret");vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-16T03:00:00Z"));mocks.dashboard.mockResolvedValue({scheduleEnabled:true});mocks.prepare.mockResolvedValue({batchIds:["batch"]});});
it("denies missing/incorrect secret without reading private data",async()=>{const response=await GET(new Request("https://example.com/api/payouts/cron"));expect(response.status).toBe(401);expect(mocks.dashboard).not.toHaveBeenCalled();});
it("prepares a review batch with Monday date idempotency and never marks paid",async()=>{const response=await GET(new Request("https://example.com/api/payouts/cron",{headers:{authorization:"Bearer test-secret"}}));expect(response.status).toBe(200);expect(mocks.prepare).toHaveBeenCalledWith(null,"monday:2026-11-16");expect(await response.json()).toMatchObject({status:"prepared_for_review",batchCount:1});expect(response.headers.get("cache-control")).toContain("no-store");});
it("does nothing when the schedule is off",async()=>{mocks.dashboard.mockResolvedValue({scheduleEnabled:false});await GET(new Request("https://example.com/api/payouts/cron",{headers:{authorization:"Bearer test-secret"}}));expect(mocks.prepare).not.toHaveBeenCalled();});
it("does nothing outside Monday Bangkok schedule",async()=>{vi.setSystemTime(new Date("2026-11-17T03:00:00Z"));await GET(new Request("https://example.com/api/payouts/cron",{headers:{authorization:"Bearer test-secret"}}));expect(mocks.prepare).not.toHaveBeenCalled();});
