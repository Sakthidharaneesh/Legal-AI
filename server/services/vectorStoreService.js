const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const VECTOR_STORE_DIR = path.join(__dirname, "../../vectorstore");
const INDEX_FILE = path.join(VECTOR_STORE_DIR, "index.json");

// Make sure vectorstore directory exists
if (!fs.existsSync(VECTOR_STORE_DIR)) {
  fs.mkdirSync(VECTOR_STORE_DIR, { recursive: true });
}

class VectorStoreService {
  constructor() {
    this.index = this.loadIndex();
  }

  loadIndex() {
    try {
      if (fs.existsSync(INDEX_FILE)) {
        const raw = fs.readFileSync(INDEX_FILE, "utf8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error("Failed to load vector index. Starting fresh.", err);
    }
    return { documents: [], chunks: [] };
  }

  saveIndex() {
    try {
      fs.writeFileSync(INDEX_FILE, JSON.stringify(this.index, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save vector index:", err);
    }
  }

  // Clear all indexed vector nodes
  flush() {
    this.index = { documents: [], chunks: [] };
    this.saveIndex();
    return true;
  }

  // Recursive Character Text Splitting
  chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      let end = start + chunkSize;
      if (end < text.length) {
        // Look for next boundary (space, newline)
        const boundary = text.lastIndexOf(" ", end);
        if (boundary > start) {
          end = boundary;
        }
      }
      chunks.push(text.slice(start, end).trim());
      start = end - overlap;
      if (start < 0 || end >= text.length) break;
    }
    return chunks.filter(c => c.length > 10);
  }

  // Generate embeddings (supporting OpenAI, Gemini, or TF-IDF fallback)
  async getEmbedding(text) {
    // 1. Check OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const res = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: text,
        });
        return { values: res.data[0].embedding, method: "openai" };
      } catch (err) {
        console.warn("OpenAI Embedding API error, trying Gemini fallback...", err.message);
      }
    }

    // 2. Check Gemini
    if (process.env.GEMINI_API_KEY) {
      try {
        // Handle Gemini API embedding
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = ai.getGenerativeModel({ model: "text-embedding-004" });
        const res = await model.embedContent(text);
        if (res && res.embedding && res.embedding.values) {
          return { values: res.embedding.values, method: "gemini" };
        }
      } catch (err) {
        console.warn("Gemini Embedding API error, falling back to TF-IDF...", err.message);
      }
    }

    // 3. TF-IDF representation fallback (word frequency dictionary)
    return { values: this.computeTfidfVector(text), method: "tfidf" };
  }

  computeTfidfVector(text) {
    const tokens = text.toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(t => t.length > 2);

    const freqMap = {};
    for (const token of tokens) {
      freqMap[token] = (freqMap[token] || 0) + 1;
    }

    // Normalize vector length to 1
    let sumSq = 0;
    for (const word in freqMap) {
      sumSq += freqMap[word] * freqMap[word];
    }
    const magnitude = Math.sqrt(sumSq);

    const normalized = {};
    if (magnitude > 0) {
      for (const word in freqMap) {
        normalized[word] = freqMap[word] / magnitude;
      }
    }
    return normalized;
  }

  // Cosine similarity between two vector profiles
  cosineSimilarity(v1, v2, method) {
    if (method === "tfidf") {
      // Vector 1 and 2 are sparse word Maps
      let dotProduct = 0;
      for (const word in v1) {
        if (v2[word]) {
          dotProduct += v1[word] * v2[word];
        }
      }
      return dotProduct;
    }

    // Dense floating-point arrays (OpenAI / Gemini)
    if (!Array.isArray(v1) || !Array.isArray(v2) || v1.length !== v2.length) {
      return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      normA += v1[i] * v1[i];
      normB += v2[i] * v2[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Index a new document
  async addDocument(documentId, title, text, metadata = {}) {
    // Remove existing chunks for this document first if present
    this.index.chunks = this.index.chunks.filter(c => c.documentId !== documentId.toString());
    this.index.documents = this.index.documents.filter(d => d.id !== documentId.toString());

    // Split text into chunks
    const chunks = this.chunkText(text);
    const docMeta = { id: documentId.toString(), title, chunkCount: chunks.length, metadata };
    this.index.documents.push(docMeta);

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      console.log(`Generating embedding for ${title} chunk ${i + 1}/${chunks.length}...`);
      const embedding = await this.getEmbedding(chunkText);
      this.index.chunks.push({
        id: `${documentId}-${i}`,
        documentId: documentId.toString(),
        documentTitle: title,
        text: chunkText,
        vector: embedding.values,
        method: embedding.method,
      });
    }

    this.saveIndex();
    return docMeta;
  }

  // Remove document from index
  removeDocument(documentId) {
    this.index.chunks = this.index.chunks.filter(c => c.documentId !== documentId.toString());
    this.index.documents = this.index.documents.filter(d => d.id !== documentId.toString());
    this.saveIndex();
  }

  // Similarity Search Query
  async similaritySearch(query, topK = 3) {
    if (this.index.chunks.length === 0) {
      return [];
    }

    const queryEmbedding = await this.getEmbedding(query);
    const matches = [];

    for (const chunk of this.index.chunks) {
      // Handle method compatibility (e.g. if indexed vector method matches query method)
      // If index methods mismatch (e.g. key changed), we default comparison or recompute
      let currentChunkVector = chunk.vector;
      let currentChunkMethod = chunk.method;

      if (currentChunkMethod !== queryEmbedding.method) {
        // Recalculate chunk vector dynamically to match query method on the fly if needed
        const newEmbed = await this.getEmbedding(chunk.text);
        currentChunkVector = newEmbed.values;
        currentChunkMethod = newEmbed.method;
      }

      const score = this.cosineSimilarity(queryEmbedding.values, currentChunkVector, queryEmbedding.method);
      matches.push({
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        text: chunk.text,
        score: parseFloat(score.toFixed(4)),
      });
    }

    // Sort by descending score
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, topK);
  }
}

module.exports = new VectorStoreService();
