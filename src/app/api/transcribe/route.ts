import { NextRequest, NextResponse } from "next/server";

/**
 * Extracts a YouTube video ID from various URL formats.
 */
function extractVideoId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
    return input.trim();
  }

  try {
    const url = new URL(input);

    if (url.hostname === "youtu.be") {
      return url.pathname.slice(1) || null;
    }

    if (
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      const vParam = url.searchParams.get("v");
      if (vParam) return vParam;

      const pathMatch = url.pathname.match(
        /^\/(shorts|embed|v)\/([a-zA-Z0-9_-]{11})/
      );
      if (pathMatch) return pathMatch[2];
    }
  } catch {
    // not a valid URL
  }

  const fallback = input.match(
    /(?:v=|\/v\/|\/embed\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return fallback ? fallback[1] : null;
}

/**
 * Fetches video metadata using YouTube's free oEmbed endpoint (no API key needed).
 */
async function fetchVideoMeta(videoId: string): Promise<{ title: string; author: string } | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data.title || "", author: data.author_name || "" };
  } catch {
    return null;
  }
}

/**
 * Tries to scrape caption text directly from YouTube's watch page.
 * Falls back to metadata-only if captions unavailable.
 */
async function fetchCaptionText(videoId: string): Promise<string | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Extract caption track URL from the page's player response
    // Use a bracket-counting approach since the JSON array can contain nested objects
    const captionStart = html.indexOf('"captionTracks":');
    if (captionStart === -1) return null;

    const arrayStart = html.indexOf("[", captionStart);
    if (arrayStart === -1) return null;

    let depth = 0;
    let arrayEnd = arrayStart;
    for (let i = arrayStart; i < html.length && i < arrayStart + 5000; i++) {
      if (html[i] === "[") depth++;
      else if (html[i] === "]") depth--;
      if (depth === 0) { arrayEnd = i + 1; break; }
    }

    // The JSON contains unicode-escaped ampersands — decode them
    const rawJson = html.slice(arrayStart, arrayEnd).replace(/\\u0026/g, "&");

    let tracks;
    try {
      tracks = JSON.parse(rawJson);
    } catch {
      return null;
    }

    if (!tracks || tracks.length === 0) return null;

    // Prefer English, fall back to first available
    const enTrack = tracks.find((t: { languageCode: string }) =>
      t.languageCode?.startsWith("en")
    ) || tracks[0];

    if (!enTrack?.baseUrl) return null;

    // Fetch the actual caption XML
    const captionRes = await fetch(enTrack.baseUrl, { signal: AbortSignal.timeout(8000) });
    if (!captionRes.ok) return null;

    const xml = await captionRes.text();

    // Strip XML tags, decode HTML entities, join into plain text
    const text = xml
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    return text.length > 50 ? text : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing YouTube URL" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    // Try to get actual captions first
    const captions = await fetchCaptionText(videoId);

    // Always get metadata as a supplement
    const meta = await fetchVideoMeta(videoId);

    if (captions) {
      // Truncate very long transcripts to ~12000 chars to stay within Groq token limits
      const trimmed = captions.length > 12000 ? captions.slice(0, 12000) + "..." : captions;
      return NextResponse.json({
        transcript: trimmed,
        title: meta?.title || "",
        author: meta?.author || "",
        source: "captions",
        videoId,
      });
    }

    // No captions available — return metadata so Groq can generate based on the topic
    if (meta && meta.title) {
      return NextResponse.json({
        transcript: null,
        title: meta.title,
        author: meta.author,
        source: "metadata",
        videoId,
      });
    }

    return NextResponse.json(
      { error: "Could not fetch video info. Please check the URL." },
      { status: 404 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
