export interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  site?: string;
}

function getMeta(doc: Document, ...names: string[]): string | undefined {
  for (const name of names) {
    const el =
      doc.querySelector(`meta[property="${name}"]`) ??
      doc.querySelector(`meta[name="${name}"]`);
    const val = el?.getAttribute("content")?.trim();
    if (val) return val;
  }
}

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
  } catch {}
  return null;
}

async function fetchYouTube(url: string): Promise<LinkPreview> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error("oembed failed");
  const json = await res.json();
  const id = getYouTubeId(url);
  return {
    title: json.title,
    description: json.author_name ? `by ${json.author_name}` : undefined,
    image: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : json.thumbnail_url,
    site: "YouTube",
  };
}

function isSpotifyUrl(url: string): boolean {
  try { return new URL(url).hostname === "open.spotify.com"; } catch { return false; }
}

function isTwitterUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return h === "x.com" || h === "twitter.com";
  } catch { return false; }
}

/** Parse @handle and tweet context purely from the URL — always works, no network needed */
function parseTwitterUrl(url: string): LinkPreview {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean); // e.g. ["username"] or ["username","status","id"]
    const handle = parts[0] ? `@${parts[0]}` : null;
    const isTweet = parts[1] === "status" && parts[2];
    return {
      title: handle ? (isTweet ? `Tweet by ${handle}` : `${handle} on X`) : "X post",
      description: handle ?? undefined,
      site: "X / Twitter",
    };
  } catch {
    return { site: "X / Twitter" };
  }
}

async function fetchTwitter(url: string): Promise<LinkPreview> {
  // Normalize x.com → twitter.com for the oEmbed endpoint
  const normalised = url.replace(/^(https?:\/\/)(www\.)?x\.com/, "https://twitter.com");

  // Try publish.twitter.com/oembed first
  const tryOembed = async (endpoint: string): Promise<LinkPreview | null> => {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const json = await res.json();
      const author: string = json.author_name ?? "";
      const handle: string = json.author_url
        ? `@${json.author_url.split("/").filter(Boolean).pop() ?? author}`
        : author ? `@${author}` : "";
      // Extract tweet text from the oEmbed HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(json.html ?? "", "text/html");
      // Strip out trailing "— Author (link)" from <p> text
      const p = doc.querySelector("blockquote p, p");
      const raw = p?.textContent?.trim() ?? "";
      // Twitter appends a pic.twitter.com/... link at the end — strip it
      const tweetText = raw.replace(/\s*pic\.twitter\.com\/\S+$/i, "").replace(/\s*https:\/\/t\.co\/\S+$/i, "").trim();
      if (!tweetText && !author) return null;
      return {
        title: tweetText || (author ? `Tweet by ${author}` : null) || undefined,
        description: handle || undefined,
        site: "X / Twitter",
      };
    } catch {
      return null;
    }
  };

  const fromOembed =
    await tryOembed(`https://publish.twitter.com/oembed?url=${encodeURIComponent(normalised)}&omit_script=true`) ??
    await tryOembed(`https://noembed.com/embed?url=${encodeURIComponent(normalised)}`);

  // Always merge with URL-parsed fallback so title is never empty
  const fallback = parseTwitterUrl(url);
  return {
    title: fromOembed?.title ?? fallback.title,
    description: fromOembed?.description ?? fallback.description,
    site: "X / Twitter",
  };
}

async function fetchSpotify(url: string): Promise<LinkPreview> {
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error("oembed failed");
  const json = await res.json();
  return {
    title: json.title,
    description: json.provider_name ?? "Spotify",
    image: json.thumbnail_url,
    site: "Spotify",
  };
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  // YouTube: use oEmbed — returns real title without JS rendering
  if (getYouTubeId(url) || url.includes("youtube.com") || url.includes("youtu.be")) {
    try { return await fetchYouTube(url); } catch {}
  }

  // Spotify: use oEmbed — returns title + artwork without CORS issues
  if (isSpotifyUrl(url)) {
    try { return await fetchSpotify(url); } catch {}
  }

  // X / Twitter: JS-rendered — use oEmbed with URL-parsed fallback guarantee
  if (isTwitterUrl(url)) {
    return fetchTwitter(url);
  }

  // General: use allorigins proxy to fetch raw HTML
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("fetch failed");
    const json = await res.json();
    const html: string = json.contents ?? "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const title =
      getMeta(doc, "og:title", "twitter:title") ??
      doc.querySelector("title")?.textContent?.trim();

    const description = getMeta(doc, "og:description", "twitter:description", "description");

    const rawImage = getMeta(doc, "og:image", "twitter:image");
    let image: string | undefined;
    if (rawImage) {
      try { image = new URL(rawImage, url).href; } catch { image = rawImage; }
    }

    const site =
      getMeta(doc, "og:site_name") ??
      (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return undefined; } })();

    return { title, description, image, site };
  } catch {
    // last resort: just return the hostname as site
    try {
      return { site: new URL(url).hostname.replace(/^www\./, "") };
    } catch {
      return {};
    }
  }
}
