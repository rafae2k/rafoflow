const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for use in HTML element content and quoted attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] as string);
}

/** Alias kept for readability at attribute call sites. */
export const escapeAttr = escapeHtml;

/** Reverses `escapeHtml` (only the entities it produces, plus &#x27;). */
export function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Turns heading text into an anchor id: lowercase ASCII letters, digits and
 * dashes. Never returns an empty string.
 */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "section" : slug;
}
