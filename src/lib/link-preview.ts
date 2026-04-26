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

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  // YouTube: use oEmbed — returns real title without JS rendering
  if (getYouTubeId(url) || url.includes("youtube.com") || url.includes("youtu.be")) {
    try { return await fetchYouTube(url); } catch {}
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
