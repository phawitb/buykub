import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentError, completeChat } from "@/lib/agent/deepseek";

function reply(payload: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(payload), { status })),
  );
}

const request = {
  model: "deepseek-flash" as const,
  messages: [{ role: "user" as const, content: "hi" }],
  maxTokens: 4000,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("completeChat", () => {
  it("returns the answer and what it cost", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    reply({
      choices: [{ message: { content: '{"name":"ok"}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 4240, completion_tokens: 1798, prompt_cache_hit_tokens: 4096 },
    });

    const completion = await completeChat(request);
    expect(completion.content).toBe('{"name":"ok"}');
    expect(completion.usage.completionTokens).toBe(1798);
  });

  it("says the draft was cut short rather than failing as an outage", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    // Reasoning is billed inside the completion, so a model that thinks its way
    // to the ceiling returns a finish_reason of "length" and no content at all.
    reply({
      choices: [{ message: { content: "" }, finish_reason: "length" }],
      usage: { prompt_tokens: 4240, completion_tokens: 2000 },
    });

    await expect(completeChat(request)).rejects.toMatchObject({
      message: "AI ร่างข้อมูลไม่จบ กรุณาลองอีกครั้ง",
      status: 502,
    });
  });

  it("names a truncated reply even when some JSON came back", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    reply({
      choices: [{ message: { content: '{"name":"ครึ่ง' }, finish_reason: "length" }],
      usage: { prompt_tokens: 10, completion_tokens: 4000 },
    });

    await expect(completeChat(request)).rejects.toBeInstanceOf(AgentError);
  });

  it("asks for the administrator when the credit has run out", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    reply({ error: { type: "insufficient_balance_error" } }, 402);

    await expect(completeChat(request)).rejects.toMatchObject({
      message: "เครดิต AI ของระบบหมด กรุณาแจ้งผู้ดูแลระบบ",
      status: 503,
    });
  });

  it("refuses to call out without a key", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(completeChat(request)).rejects.toBeInstanceOf(AgentError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
