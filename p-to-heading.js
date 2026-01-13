// migrations/h1-heading-body-to-h1.js
const he = require("he");

// Decode entities repeatedly to fix cases like &amp;lt; -> &lt; -> <
function decodeRepeatedly(input, maxPasses = 5) {
  let current = input;
  for (let i = 0; i < maxPasses; i++) {
    const next = he.decode(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

// Remove junk patterns like: <h1>&lt;h1&gt;...&lt;/h1&gt;</h1>
// while keeping real HTML tags intact.
function cleanJunkDoubleWrappedHtml(raw) {
  if (typeof raw !== "string") return raw;

  // Step 1: decode multi-escaped entities
  const decoded = decodeRepeatedly(raw).trim();

  // Step 2: If it's <h1><h1>...</h1></h1> or <h1><p>...</p></h1>, unwrap inner
  // (Only unwrap when the entire string is exactly a single wrapper)
  const outerMatch = decoded.match(/^\s*<(h1|p)\b[^>]*>([\s\S]*)<\/\1>\s*$/i);
  if (!outerMatch) return decoded;

  const outerTag = outerMatch[1].toLowerCase();
  const inner = outerMatch[2].trim();

  // If inner itself is a full single tag wrapper, unwrap it
  const innerMatch = inner.match(/^\s*<(h1|p)\b[^>]*>([\s\S]*)<\/\1>\s*$/i);
  if (!innerMatch) return decoded;

  const innerContent = innerMatch[2]; // preserve all inner HTML

  // Return cleaned: keep the outer tag, replace contents with innerContent
  return `<${outerTag}>${innerContent}</${outerTag}>`;
}

module.exports = function (migration) {
  const contentTypeId = "heroBannerFullImageBanking"; // <-- verify API identifier
  const fieldId = "heading"; // <-- verify field id for “H1 Heading”

  let changedCount = 0;
  let logged = 0;

  migration.transformEntries({
    contentType: contentTypeId,
    from: [fieldId],
    to: [fieldId],

    transformEntryForLocale: function (fromFields, locale, ctx) {
      const original = fromFields[fieldId]?.[locale];
      if (typeof original !== "string" || original.trim() === "") return;

      // decode entities (turn &lt;p&gt; into <p>)
      const decoded = he.decode(original).trim();
      const cleaned = cleanJunkDoubleWrappedHtml(decoded);
      // Only change when the ENTIRE value is wrapped in a single <p>...</p>
      // Allows attributes on p: <p class="x">...</p>
      const match = cleaned.match(/^\s*<p\b[^>]*>([\s\S]*?)<\/p>\s*$/i);
      if (!match) {
        // optional: prove we’re iterating (log first few that don't match)
        if (logged < 3) {
          console.log(`[skip] entry=${ctx?.id ?? "unknown"} locale=${locale} value-start=${cleaned.slice(0, 60)}`);
          logged++;
        }
        return;
      }

      const inner = match[1]; // preserve EVERYTHING inside (sup, strong, links, etc.)
      const updated = `<h1>${inner}</h1>`;

      // If the stored value is already effectively the updated string, do nothing
      if (updated === cleaned || updated === original.trim()) return;

      changedCount++;
      if (logged < 10) {
        console.log(`[update] entry=${ctx?.id ?? "unknown"} locale=${locale}`);
        logged++;
      }

      // IMPORTANT: return a string for a Text field
      return { [fieldId]: updated };
    },

    shouldPublish: "preserve",
  });

  // This prints once when the migration script is evaluated
  console.log("Migration loaded. Target:", { contentTypeId, fieldId });
};
