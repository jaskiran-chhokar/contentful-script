// migrations/h1-heading-body-to-h1.js
const he = require("he");

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

      // Only change when the ENTIRE value is wrapped in a single <p>...</p>
      // Allows attributes on p: <p class="x">...</p>
      const match = decoded.match(/^\s*<p\b[^>]*>([\s\S]*?)<\/p>\s*$/i);
      if (!match) {
        // optional: prove we’re iterating (log first few that don't match)
        if (logged < 3) {
          console.log(`[skip] entry=${ctx?.id ?? "unknown"} locale=${locale} value-start=${decoded.slice(0, 60)}`);
          logged++;
        }
        return;
      }

      const inner = match[1]; // preserve EVERYTHING inside (sup, strong, links, etc.)
      const updated = `<h1>${inner}</h1>`;

      // If the stored value is already effectively the updated string, do nothing
      if (updated === decoded || updated === original.trim()) return;

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
