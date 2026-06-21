import DOMPurify from "isomorphic-dompurify";

// Harden any anchors that survive sanitization: open in a new tab safely and
// avoid leaking referrer / passing link equity to attacker-controlled URLs.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer nofollow");
  }
});

// Allowlist tuned for the Rich Text block: formatting + lists + links + basic
// structure. No <script>, no inline event handlers, no <iframe>/<object>.
const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "span", "div",
    "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "blockquote", "code", "pre",
    "a",
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "style", "class"],
  // Disallow data:/javascript: URIs in href; keep http(s)/mailto/tel/relative.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
};

/** Sanitize author-supplied Rich Text HTML before rendering on public pages. */
export function sanitizeRichText(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, RICH_TEXT_CONFIG);
}
