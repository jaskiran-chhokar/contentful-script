// migrations/h1-heading-body-to-h1.js
const cheerio = require("cheerio");
const he = require("he");

module.exports = function (migration) {
  const contentTypeId = "heroBannerFullImageBanking"; // <-- confirm this is your Content Type ID
  const fieldId = "heading"; // <-- confirm this is your field ID for "H1 Heading"

  migration.transformEntries({
    contentType: contentTypeId,
    from: [fieldId],
    to: [fieldId],

    transformEntryForLocale: function (fromFields, locale) {
      const original = fromFields[fieldId]?.[locale];
      if (original == null || original === "") return;
      if (typeof original !== "string") return;

      let value = original.trim();

      // 1) If stored as escaped HTML, decode it first
      if (value.includes("&lt;") || value.includes("&gt;")) {
        value = he.decode(value);
      }

      // 2) If plain text (no tags), wrap safely in <h1>
      const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value);
      if (!looksLikeHtml) {
        const wrapped = `<h1>${escapeHtml(value)}</h1>`;
        if (wrapped !== original) return { [fieldId]: wrapped };
        return;
      }

      // 3) Parse HTML
      const $ = cheerio.load(value, { decodeEntities: false });

      // ✅ FIX: keep ONLY element nodes (tags)
      const topLevelTags = $.root()
        .children()
        .toArray()
        .filter((node) => node.type === "tag"); // <-- correct

      if (topLevelTags.length === 0) return;

      // Case A: <h1><p>...</p></h1>  -> <h1>...</h1>
      if (topLevelTags.length === 1 && topLevelTags[0].name === "h1") {
        const h1 = topLevelTags[0];

        const h1TagChildren = $(h1)
          .contents()
          .toArray()
          .filter((n) => n.type === "tag");

        if (h1TagChildren.length === 1 && h1TagChildren[0].name === "p") {
          const inner = $(h1TagChildren[0]).html() ?? "";
          $(h1).html(inner);

          const fixed = $.root().html() ?? "";
          if (fixed && fixed !== original) return { [fieldId]: fixed };
        }
        return;
      }

      // Case B: <p>...</p> -> <h1>...</h1> (preserve inner HTML e.g. <sup>)
      const first = topLevelTags[0];

      if (first.name === "p") {
        const inner = $(first).html() ?? "";
        $(first).replaceWith(`<h1>${inner}</h1>`);

        const updated = $.root().html() ?? "";
        if (updated && updated !== original) return { [fieldId]: updated };
        return;
      }

      // Already starts with <h1>, do nothing
      if (first.name === "h1") return;

      // Otherwise leave as-is
      return;
    },

    shouldPublish: "preserve",
  });
};

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
