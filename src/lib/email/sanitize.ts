import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Email HTML is untrusted input. This is sanitized server-side AND rendered
 * client-side inside a scriptless sandboxed <ifram> (never
 * dangerouslySetInnerHTML directly into the page) — defence in depth so a
 * malicious email can't run script, exfiltrate data, or otherwise touch the
 * CRM even if one layer has a gap.
 *
 * Remote images are never allowed to load automatically: their src is moved
 * to data-safe-src, and the client only restores it when staff explicitly
 * click "Load external images" for that message.
 */

const ALLOWED_TAGS = [
  "a", "b", "strong", "i", "em", "u", "s", "strike", "p", "br", "hr", "span", "div",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "img", "font", "center", "small", "sub", "sup",
];

export function sanitizeEmailHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title"],
      img: ["alt", "width", "height", "data-safe-src", "src"],
      table: ["width", "cellpadding", "cellspacing", "border"],
      td: ["colspan", "rowspan", "align", "valign"],
      th: ["colspan", "rowspan", "align", "valign"],
      font: ["color", "size", "face"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["data"] }, // only inline data: images render immediately; http(s) go through data-safe-src below
    transformTags: {
      img: (_tagName, attribs) => {
        const src = attribs.src ?? "";
        const isInline = src.startsWith("data:");
        return {
          tagName: "img",
          attribs: {
            ...(attribs.alt ? { alt: attribs.alt } : {}),
            ...(attribs.width ? { width: attribs.width } : {}),
            ...(attribs.height ? { height: attribs.height } : {}),
            ...(isInline ? { src } : src ? { "data-safe-src": src } : {}),
          },
        };
      },
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
    },
    disallowedTagsMode: "discard",
  });
}

export function plainTextToSafeHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;word-break:break-word">${escaped}</pre>`;
}
