/**
 * Splits a search query into lowercase, non-empty terms.
 */
export const parseSearchTerms = (query) =>
  (query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Amazon-style prefix match for a single text value.
 *
 * Returns true when the text starts with the full query OR every query
 * term is a prefix of at least one word in the text.
 *
 *   matchesPrefix('Protein Powder', 'pro')      → true  ("Protein" starts with "pro")
 *   matchesPrefix('Protein Powder', 'pow')       → true  ("Powder" starts with "pow")
 *   matchesPrefix('Protein Powder', 'pro pow')   → true  (both words prefix-match)
 *   matchesPrefix('Protein Powder', 'tein')      → false (no word starts with "tein")
 *   matchesPrefix('Whey Protein',   'pro')       → true  ("Protein" starts with "pro")
 */
export const matchesPrefix = (text, query) => {
  const lower = (text ?? '').toString().toLowerCase();
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return false;

  // Full prefix — the label starts with the entire typed query
  if (lower.startsWith(q)) return true;

  // Word-level prefix — every query term is the start of some word
  const terms = q.split(/\s+/).filter(Boolean);
  const words = lower.split(/\s+/);
  return terms.every((term) => words.some((word) => word.startsWith(term)));
};

/**
 * Scores a prefix match so better matches sort first.
 *   2 — the full label starts with the full query  (best)
 *   1 — word-level prefix match
 *   0 — no match
 */
export const prefixMatchScore = (text, query) => {
  const lower = (text ?? '').toString().toLowerCase();
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return 0;

  if (lower.startsWith(q)) return 2;

  const terms = q.split(/\s+/).filter(Boolean);
  const words = lower.split(/\s+/);
  if (terms.every((term) => words.some((word) => word.startsWith(term)))) return 1;

  return 0;
};

/**
 * Row-level filter across multiple fields using prefix matching.
 *
 * Returns true when *every* query term is a prefix of at least one word
 * in at least one of the provided field values.
 *
 *   matchesAcrossFields(['John Smith', 'admin'], 'jo ad')  → true
 *   matchesAcrossFields(['John Smith', 'active'], 'jo ad') → false ("active" ≠ "admin"… wait, "ad" is not a prefix of "active")… actually "active" starts with "ac" not "ad", so false ✓
 */
export const matchesAcrossFields = (fields, query) => {
  const terms = parseSearchTerms(query);
  if (!terms.length) return false;

  const allWords = fields
    .filter(Boolean)
    .flatMap((v) => v.toString().toLowerCase().split(/\s+/));

  return terms.every((term) => allWords.some((word) => word.startsWith(term)));
};
