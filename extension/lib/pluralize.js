/* English plurals for counters ("1 check", "3 checks", "1 reply", "2 replies"). */
(() => {
  const IRREGULAR = { reply: "replies", person: "people", child: "children" };

  function plural(word, n) {
    if (n === 1) return word;
    if (IRREGULAR[word]) return IRREGULAR[word];
    if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
    if (/(s|x|z|ch|sh)$/.test(word)) return word + "es";
    return word + "s";
  }

  const count = (n, word) => `${n} ${plural(word, n)}`;

  function list(items, conjunction = "and") {
    if (items.length <= 1) return items.join("");
    if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items.at(-1)}`;
  }

  const api = { plural, count, list };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).pluralize = api;
})();
