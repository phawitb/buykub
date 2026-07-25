type GoogleCalendarRequest = {
  eventUrl: string;
  eventBody: unknown;
  accessToken: string;
  refreshToken: string | null;
  clientId: string | null;
  clientSecret: string | null;
  fetchImpl?: typeof fetch;
};

export async function createGoogleCalendarEvent(
  request: GoogleCalendarRequest,
): Promise<{ response: Response; accessToken: string | null }> {
  const fetchImpl = request.fetchImpl ?? fetch;
  const sendEvent = (accessToken: string) =>
    fetchImpl(request.eventUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.eventBody),
    });

  const initialResponse = await sendEvent(request.accessToken);
  if (
    initialResponse.status !== 401 ||
    !request.refreshToken ||
    !request.clientId ||
    !request.clientSecret
  ) {
    return { response: initialResponse, accessToken: null };
  }

  const refreshResponse = await fetchImpl(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: request.clientId,
        client_secret: request.clientSecret,
        refresh_token: request.refreshToken,
        grant_type: "refresh_token",
      }),
    },
  );
  if (!refreshResponse.ok) {
    return { response: initialResponse, accessToken: null };
  }

  const refreshed = (await refreshResponse.json()) as {
    access_token?: string;
  };
  if (!refreshed.access_token) {
    return { response: initialResponse, accessToken: null };
  }

  return {
    response: await sendEvent(refreshed.access_token),
    accessToken: refreshed.access_token,
  };
}
