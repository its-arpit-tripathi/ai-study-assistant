/**
 * Split multi-part questions into generic retrieval facets. This is deliberately
 * topic-agnostic: it never names document-specific concepts or chapter numbers.
 */
export function decomposeQuery(query) {
  const original = String(query || '').replace(/\s+/g, ' ').trim();
  if (!original) return [];

  const parts = original
    .split(/(?:[?;.!]+\s*|\s+(?:and\s+also|as\s+well\s+as|and|also|versus|vs\.?|compared\s+with|compared\s+to)\s+)/i)
    .map((part) => part.trim().replace(/^[,.:;\-\s]+|[,.:;\-\s]+$/g, ''))
    .filter((part) => part.length >= 8);

  // Avoid turning ordinary short questions into fragments, and cap the extra work.
  const unique = [...new Set(parts)];

  // Source restrictions and other answer constraints guide generation, but are
  // not semantic retrieval targets. Sending them to the cross-encoder can make
  // unrelated passages rank highly (e.g. a chunk about document policy rather
  // than the topic being asked about).
  const isConstraintOnly = (part) =>
    /^(?:(?:please\s+)?do not|don't|never|only|just)\b/i.test(part) ||
    /\b(?:do not use|don't use|use only|only use|must not use)\b.*\b(?:other documents?|other sources?|outside information|external sources?)\b/i.test(part) ||
    /\b(?:answer|respond|use information)\b.*\bonly\b.*\b(?:uploaded|provided|attached)\b/i.test(part);

  if (unique.length < 2) return [original];

  const useful = unique.filter((part) =>
    (part.match(/[a-z0-9]+/gi) || []).length >= 2 && !isConstraintOnly(part)
  );
  if (useful.length >= 2) return useful.slice(0, 4);
  if (useful.length === 1) return useful;
  return [original];
}

function contentTokens(chunk) {
  const stopWords = new Set([
    'the','and','for','that','with','from','this','what','when','where','which',
    'who','why','how','does','did','are','was','were','about','into','their',
    'there','have','has','had','can','could','would','should','chapter','summarize',
    'explain','describe','compare','between','using','use','its','than','then'
  ]);
  return new Set(
    (String(chunk.pageContent || '').toLowerCase().match(/[a-z0-9]+/g) || [])
      .filter((token) => token.length > 2 && !stopWords.has(token))
  );
}

function jaccardSimilarity(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/** MMR balances relevance with evidence diversity to reduce redundant chunks. */
export function selectDiverseResults(rankedChunks, limit = 5, lambda = 0.62) {
  const candidates = Array.isArray(rankedChunks) ? rankedChunks : [];
  const selected = [];
  const remaining = candidates.map((chunk, rank) => ({
    chunk,
    rank,
    tokens: contentTokens(chunk),
    // Rank-based relevance is robust to cross-encoder logit scales.
    relevance: candidates.length <= 1 ? 1 : 1 - rank / candidates.length,
  }));

  while (remaining.length && selected.length < limit) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const redundancy = selected.length
        ? Math.max(...selected.map((item) => jaccardSimilarity(candidate.tokens, item.tokens)))
        : 0;
      const score = lambda * candidate.relevance - (1 - lambda) * redundancy;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected.map(({ chunk }) => chunk);
}



/**
 * Reserve evidence for every query facet before filling the remaining context
 * with MMR-selected chunks. This is generic coverage logic, not topic-specific
 * rules: each facet gets its own highest-ranked available evidence chunk.
 */
export function selectFacetAwareResults(facetRankings, combinedRankedChunks, limit = 5, lambda = 0.62) {
  const maxResults = Math.max(1, Number(limit) || 5);
  const selected = [];
  const selectedIds = new Set();
  const idOf = (chunk) => String(
    chunk?.metadata?.chunkId ||
    `${chunk?.metadata?.documentId || 'doc'}:${chunk?.metadata?.chunkIndex ?? ''}:${String(chunk?.pageContent || '').slice(0, 80)}`
  );

  // First reserve the best candidate for each facet. Do not allow one broad
  // chunk to consume every slot merely because it ranks moderately for all facets.
  for (const ranking of (Array.isArray(facetRankings) ? facetRankings : [])) {
    const best = (Array.isArray(ranking) ? ranking : []).find((chunk) => !selectedIds.has(idOf(chunk)));
    if (!best) continue;
    selected.push(best);
    selectedIds.add(idOf(best));
    if (selected.length >= maxResults) return selected.slice(0, maxResults);
  }

  const remaining = (Array.isArray(combinedRankedChunks) ? combinedRankedChunks : [])
    .filter((chunk) => !selectedIds.has(idOf(chunk)));
  const extra = selectDiverseResults(remaining, maxResults - selected.length, lambda);
  for (const chunk of extra) {
    const id = idOf(chunk);
    if (!selectedIds.has(id)) {
      selected.push(chunk);
      selectedIds.add(id);
    }
    if (selected.length >= maxResults) break;
  }
  return selected;
}
