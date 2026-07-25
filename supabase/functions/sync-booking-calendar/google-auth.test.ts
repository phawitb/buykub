import { describe, expect, it, vi } from "vitest";
import { createGoogleCalendarEvent } from "./google-auth";

describe("createGoogleCalendarEvent", () => {
  it("refreshes an expired Google token and retries the calendar request once", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(
        Response.json({ access_token: "fresh-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(Response.json({ id: "event-1" }));

    const result = await createGoogleCalendarEvent({
      eventUrl: "https://www.googleapis.com/calendar/v3/events",
      eventBody: { summary: "Test booking" },
      accessToken: "expired-token",
      refreshToken: "refresh-token",
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      fetchImpl,
    });

    expect(result.response.ok).toBe(true);
    expect(result.accessToken).toBe("fresh-token");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][0]).toBe(
      "https://oauth2.googleapis.com/token",
    );
    expect(String(fetchImpl.mock.calls[1][1]?.body)).toContain(
      "grant_type=refresh_token",
    );
    expect(fetchImpl.mock.calls[2][1]?.headers).toMatchObject({
      Authorization: "Bearer fresh-token",
    });
  });

  it("does not refresh or retry when Google returns a non-auth error", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("quota", { status: 429 }));

    const result = await createGoogleCalendarEvent({
      eventUrl: "https://www.googleapis.com/calendar/v3/events",
      eventBody: { summary: "Test booking" },
      accessToken: "current-token",
      refreshToken: "refresh-token",
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
      fetchImpl,
    });

    expect(result.response.status).toBe(429);
    expect(result.accessToken).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
