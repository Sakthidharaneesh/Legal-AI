/**
 * Hybrid Search Service
 * Combines:
 *   1. Dense search — semantic vector similarity (existing vectorStoreService)
 *   2. Sparse search — BM25 keyword matching for legal terminology
 *   3. RRF merge    — Reciprocal Rank Fusion to combine ranked lists
 *   4. Re-ranking   — Cross-encoder style re-scoring using LLM API
 *   5. Query Expansion — LLM-generated legal synonym queries
 *   6. Result caching — NodeCache TTL-based caching
 */

const NodeCache = require("node-cache");
const BM25 = require("wink-bm25-text-search");
const vectorStoreService = require("./vectorStoreService");

const queryCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 }); // 1hr TTL

// Legal stop words (omit from BM25 indexing)
const LEGAL_STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","as","is","was","are","were","be","been","being","have",
  "has","had","do","does","did","will","would","could","should","may",
  "might","shall","this","that","these","those","it","its","they","their"
]);

class HybridSearchService {
  constructor() {
    this.bm25 = null;
    this.bm25Corpus = [];       // [{id, text, documentTitle, documentId}]
    this.bm25Indexed = false;
    this._rebuildBM25();
  }

  // ── BM25 Setup ──────────────────────────────────────────────────────────────
  _tokenize(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 2 && !LEGAL_STOP_WORDS.has(t));
  }

  _rebuildBM25() {
    try {
      const engine = BM25();
      engine.defineConfig({ fldWeights: { text: 1, title: 2 } });
      engine.definePrepTasks([
        (tokens) => tokens,       // identity — we pre-tokenize
      ]);

      const index = vectorStoreService.index;
      if (!index || !index.chunks || index.chunks.length === 0) {
        this.bm25 = engine;
        this.bm25Indexed = false;
        return;
      }

      this.bm25Corpus = index.chunks.map((chunk, i) => ({
        id: i,
        chunkRef: chunk,
        text: this._tokenize(chunk.text).join(" "),
        title: this._tokenize(chunk.documentTitle || "").join(" "),
      }));

      engine.addDoc({ text: "init", title: "init" }, 0); // required first doc
      this.bm25Corpus.forEach((doc, i) => {
        if (i === 0) return; // skip, already added as init
        try { engine.addDoc({ text: doc.text, title: doc.title }, doc.id); } catch (_) {}
      });

      engine.consolidate(0);
      this.bm25 = engine;
      this.bm25Indexed = true;
      console.log(`[HybridSearch] BM25 index built with ${this.bm25Corpus.length} chunks.`);
    } catch (err) {
      console.warn("[HybridSearch] BM25 build failed (this is OK if the vector store is empty):", err.message);
      this.bm25Indexed = false;
    }
  }

  refreshBM25() {
    this.bm25Indexed = false;
    this._rebuildBM25();
  }

  // ── Query Expansion ─────────────────────────────────────────────────────────
  async expandQuery(query) {
    const cacheKey = `expand:${query.substring(0, 100)}`;
    const cached = queryCache.get(cacheKey);
    if (cached) return cached;

    const expansions = [query]; // always include original

    try {
      const prompt = `You are a legal search assistant. Generate 3 alternative legal phrasings for this query. Return ONLY a JSON array of strings, no explanation.
Query: "${query}"
Example output: ["alternative 1", "alternative 2", "alternative 3"]`;

      let response = null;

      if (process.env.OPENAI_API_KEY) {
        const openaiModule = require("openai");
        const OpenAIClass = openaiModule.OpenAI || openaiModule.default || openaiModule;
        const isGroq = process.env.OPENAI_API_KEY.startsWith("gsk_");
        const client = new OpenAIClass({
          apiKey: process.env.OPENAI_API_KEY,
          baseURL: isGroq ? "https://api.groq.com/openai/v1" : undefined,
        });
        const res = await client.chat.completions.create({
          model: isGroq ? "llama-3.1-8b-instant" : "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 200,
        });
        response = res.choices[0].message.content;
      } else if (process.env.GEMINI_API_KEY) {
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        response = result.response.text();
      }

      if (response) {
        const match = response.match(/\[[\s\S]*?\]/);
        if (match) {
          const variants = JSON.parse(match[0]);
          if (Array.isArray(variants)) {
            variants.forEach(v => { if (typeof v === "string" && v.trim()) expansions.push(v.trim()); });
          }
        }
      }
    } catch (err) {
      console.warn("[HybridSearch] Query expansion failed (non-critical):", err.message);
    }

    queryCache.set(cacheKey, expansions);
    return expansions;
  }

  // ── BM25 Search ─────────────────────────────────────────────────────────────
  bm25Search(query, topK = 20) {
    if (!this.bm25Indexed || !this.bm25) return [];
    try {
      const tokenized = this._tokenize(query).join(" ");
      const results = this.bm25.search(tokenized, null, topK);
      return results.map(([id, score]) => {
        const doc = this.bm25Corpus[id];
        if (!doc) return null;
        return {
          documentId: doc.chunkRef.documentId,
          documentTitle: doc.chunkRef.documentTitle,
          text: doc.chunkRef.text,
          score: parseFloat((score * 0.1).toFixed(4)),   // normalise BM25 score
          source: "bm25",
        };
      }).filter(Boolean);
    } catch (err) {
      console.warn("[HybridSearch] BM25 search error:", err.message);
      return [];
    }
  }

  // ── Reciprocal Rank Fusion ──────────────────────────────────────────────────
  reciprocalRankFusion(rankedLists, k = 60) {
    const scores = new Map(); // key → {score, item}

    for (const list of rankedLists) {
      list.forEach((item, rank) => {
        const key = item.text.substring(0, 100); // use text snippet as unique key
        const rrfScore = 1 / (k + rank + 1);
        if (scores.has(key)) {
          scores.get(key).score += rrfScore;
        } else {
          scores.set(key, { score: rrfScore, item });
        }
      });
    }

    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .map(({ score, item }) => ({ ...item, score: parseFloat(score.toFixed(4)), source: "hybrid_rrf" }));
  }

  // ── LLM Re-Ranking ──────────────────────────────────────────────────────────
  async rerankWithLLM(query, chunks, topK = 5) {
    if (chunks.length <= topK) return chunks.slice(0, topK);

    // Score each chunk with a quick relevance question
    try {
      const snippets = chunks.slice(0, 15).map((c, i) => `[${i}] ${c.text.substring(0, 300)}`).join("\n\n");
      const prompt = `You are a legal document relevance judge. Rate these ${Math.min(chunks.length, 15)} text chunks for relevance to the query.
Query: "${query}"

Chunks:
${snippets}

Return ONLY a JSON array of indices sorted by relevance (most relevant first), e.g.: [2, 0, 5, 1, 3]`;

      let response = null;
      if (process.env.OPENAI_API_KEY) {
        const openaiModule = require("openai");
        const OpenAIClass = openaiModule.OpenAI || openaiModule.default || openaiModule;
        const isGroq = process.env.OPENAI_API_KEY.startsWith("gsk_");
        const client = new OpenAIClass({
          apiKey: process.env.OPENAI_API_KEY,
          baseURL: isGroq ? "https://api.groq.com/openai/v1" : undefined,
        });
        const res = await client.chat.completions.create({
          model: isGroq ? "llama-3.1-8b-instant" : "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          max_tokens: 100,
        });
        response = res.choices[0].message.content;
      }

      if (response) {
        const match = response.match(/\[[\d\s,]+\]/);
        if (match) {
          const order = JSON.parse(match[0]);
          const reranked = order
            .filter(i => typeof i === "number" && i >= 0 && i < chunks.length)
            .map(i => ({ ...chunks[i], reranked: true }));
          // Append any not in order
          const covered = new Set(order);
          chunks.forEach((c, i) => { if (!covered.has(i)) reranked.push(c); });
          return reranked.slice(0, topK);
        }
      }
    } catch (err) {
      console.warn("[HybridSearch] LLM re-ranking failed (non-critical):", err.message);
    }

    return chunks.slice(0, topK);
  }

  // ── Apply Jurisdiction Filter ────────────────────────────────────────────────
  filterByJurisdiction(chunks, jurisdiction) {
    if (!jurisdiction || jurisdiction === "general") return chunks;
    const jLower = jurisdiction.toLowerCase();
    const prioritized = chunks.filter(c =>
      (c.documentTitle || "").toLowerCase().includes(jLower) ||
      (c.text || "").toLowerCase().includes(jLower)
    );
    // If we found jurisdiction-specific chunks, prefer them but keep others
    if (prioritized.length >= 2) {
      const rest = chunks.filter(c => !prioritized.includes(c));
      return [...prioritized, ...rest];
    }
    return chunks;
  }

  // ── Main Hybrid Search ───────────────────────────────────────────────────────
  async hybridSearch(query, topK = 5, options = {}) {
    const { jurisdiction = "general", skipExpansion = false, skipRerank = false } = options;

    // Check cache
    const cacheKey = `hybrid:${query.substring(0, 80)}:${jurisdiction}:${topK}`;
    const cached = queryCache.get(cacheKey);
    if (cached) {
      console.log("[HybridSearch] Cache hit for query.");
      return cached;
    }

    // Refresh BM25 if vector store has changed
    if (!this.bm25Indexed && vectorStoreService.index.chunks.length > 0) {
      this.refreshBM25();
    }

    // 1. Query Expansion
    const queries = skipExpansion ? [query] : await this.expandQuery(query);
    console.log(`[HybridSearch] Using ${queries.length} query variant(s).`);

    // 2. Run dense + sparse for each query variant
    const denseResults = [];
    const sparseResults = [];

    for (const q of queries) {
      const dense = await vectorStoreService.similaritySearch(q, 20);
      denseResults.push(...dense);
      if (this.bm25Indexed) {
        const sparse = this.bm25Search(q, 20);
        sparseResults.push(...sparse);
      }
    }

    // Deduplicate
    const dedup = (arr) => {
      const seen = new Set();
      return arr.filter(item => {
        const key = item.text.substring(0, 100);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const dedupedDense = dedup(denseResults);
    const dedupedSparse = dedup(sparseResults);

    // 3. RRF Merge
    let merged;
    if (dedupedSparse.length > 0) {
      merged = this.reciprocalRankFusion([dedupedDense, dedupedSparse]);
    } else {
      merged = dedupedDense; // fall back to dense only
    }

    // 4. Jurisdiction filter
    const filtered = this.filterByJurisdiction(merged, jurisdiction);

    // 5. Re-rank with LLM
    let final;
    if (!skipRerank && filtered.length > topK) {
      final = await this.rerankWithLLM(query, filtered, topK);
    } else {
      final = filtered.slice(0, topK);
    }

    // Filter out very low-score results
    const qualified = final.filter(c => c.score > 0.01);
    const results = qualified.length > 0 ? qualified : final;

    queryCache.set(cacheKey, results);
    return results;
  }
}

module.exports = new HybridSearchService();
