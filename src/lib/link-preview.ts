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

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  // Use allorigins to bypass CORS — returns raw HTML in contents field
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
  // resolve relative image URLs against the origin
  let image: string | undefined;
  if (rawImage) {
    try {
      image = new URL(rawImage, url).href;
    } catch {
      image = rawImage;
    }
  }

  const site =
    getMeta(doc, "og:site_name") ??
    (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return undefined; } })();

  return { title, description, image, site };
}
