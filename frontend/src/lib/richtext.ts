import DOMPurify from "dompurify";

/** Content written with the admin editor is HTML; older content is plain text with blank-line paragraphs. */
export const isHtml = (s: string) => /<(p|h[1-6]|ul|ol|li|table|div|strong|em|s|a|br|img|span|blockquote|iframe)\b[^>]*>/i.test(s);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text -> editor HTML (one <p> per blank-line paragraph). HTML passes through. */
export function toEditorHtml(s: string): string {
  if (!s.trim()) return "";
  if (isHtml(s)) return s;
  return s.split(/\n\s*\n/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
}

/** HTML -> readable text (SEO descriptions, length checks). Plain text passes through. */
export function toPlain(s: string): string {
  if (!s || !isHtml(s)) return (s ?? "").trim();
  const doc = new DOMParser().parseFromString(s.replace(/<\/(p|h[1-6]|li|td|th|div)>/gi, "</$1> "), "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

const YT = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//;
DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName === "iframe" && !YT.test((node as Element).getAttribute("src") ?? "")) node.parentNode?.removeChild(node);
});
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("target") === "_blank") node.setAttribute("rel", "noopener noreferrer");
  if (node.tagName === "INPUT") node.setAttribute("disabled", "");
});

/** Only editor-produced markup survives: no scripts/handlers; iframes only for YouTube embeds.
 *  An <h1> inside content becomes <h2> — every page already has exactly one H1 (its title). */
export const sanitize = (html: string) => DOMPurify.sanitize(html, {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: ["target", "allow", "allowfullscreen", "frameborder", "data-type", "data-checked", "colspan", "rowspan", "colwidth", "data-youtube-video"],
}).replace(/<(\/?)h1(\s|>)/gi, "<$1h2$2");
