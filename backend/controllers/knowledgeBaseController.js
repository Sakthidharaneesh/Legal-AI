const vectorStoreService = require("../services/vectorStoreService");
const { parseFileBuffer } = require("../utils/fileParser");

// Add a manual knowledge base article
exports.addArticle = async (req, res) => {
  try {
    const { title, content, framework, source } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required." });
    }
    const docId = `kb-${Date.now()}`;
    console.log(`[KnowledgeBase] Indexing article: "${title}"`);
    const result = await vectorStoreService.addDocument(docId, title, content, { framework, source });
    res.json({ success: true, document: result });
  } catch (err) {
    console.error("KnowledgeBase Add Error:", err);
    res.status(500).json({ error: "Failed to add article." });
  }
};

// List all indexed knowledge base items
exports.listArticles = async (req, res) => {
  try {
    const index = vectorStoreService.index;
    const articles = index.documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      chunkCount: doc.chunkCount,
      metadata: doc.metadata || {}
    }));
    res.json(articles);
  } catch (err) {
    console.error("KnowledgeBase List Error:", err);
    res.status(500).json({ error: "Failed to list articles." });
  }
};

// Delete a knowledge base article
exports.deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;
    vectorStoreService.removeDocument(id);
    res.json({ success: true });
  } catch (err) {
    console.error("KnowledgeBase Delete Error:", err);
    res.status(500).json({ error: "Failed to delete article." });
  }
};

// Search the knowledge base
exports.search = async (req, res) => {
  try {
    const { query, topK } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query is required." });
    }
    const results = await vectorStoreService.similaritySearch(query, topK || 5);
    res.json(results);
  } catch (err) {
    console.error("KnowledgeBase Search Error:", err);
    res.status(500).json({ error: "Failed to search knowledge base." });
  }
};

// Flush entire knowledge base
exports.flush = async (req, res) => {
  try {
    vectorStoreService.flush();
    res.json({ success: true, message: "Knowledge base cleared." });
  } catch (err) {
    console.error("KnowledgeBase Flush Error:", err);
    res.status(500).json({ error: "Failed to flush knowledge base." });
  }
};

// Upload document file directly to knowledge base
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const { framework, source } = req.body;
    const filename = req.file.originalname;
    const title = req.body.title || filename.replace(/\.[^/.]+$/, "");
    const docId = `kb-${Date.now()}`;

    console.log(`[KnowledgeBase] Parsing and indexing file: "${filename}"`);
    const content = await parseFileBuffer(req.file.buffer, filename, req.file.mimetype);

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "Failed to extract text content from the file." });
    }

    const result = await vectorStoreService.addDocument(docId, title, content, { 
      framework: framework || "General", 
      source: source || filename 
    });

    res.json({ success: true, document: result });
  } catch (err) {
    console.error("KnowledgeBase File Upload Error:", err);
    res.status(500).json({ error: "Failed to parse and index document into knowledge base." });
  }
};
