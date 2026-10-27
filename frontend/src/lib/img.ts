/** Resize remote photos for the slot they fill (Unsplash / imgix CDNs): a card needs ~640px, not a 4000px original. */
export function sizedImg(url: string | undefined | null, width: number): string {
  if (!url) return "";
  try {
    const u = new URL(url, window.location.origin);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", "70");
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      return u.toString();
    }
    if (u.hostname.endsWith(".imgix.net")) {
      u.searchParams.set("w", String(width));
      u.searchParams.set("auto", "format,compress");
      return u.toString();
    }
  } catch {
    /* relative or malformed: leave as is */
  }
  return url;
}
