const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function normalizeLinkUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeYoutubeUrl(value: string): string | null {
  const normalized = normalizeLinkUrl(value);
  if (!normalized) return null;

  const url = new URL(normalized);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  let videoId: string | null = null;

  if (hostname === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (
    hostname === "youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "youtube-nocookie.com"
  ) {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else {
      const [kind, id] = url.pathname.split("/").filter(Boolean);
      if (kind === "shorts" || kind === "embed") videoId = id ?? null;
    }
  }

  if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
