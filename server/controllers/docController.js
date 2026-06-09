const Document = require("../models/document");
const pdfParse = require("pdf-parse");
const analyzerAgent = require("../agents/analyzerAgent");
const vectorStoreService = require("../services/vectorStoreService");

exports.uploadDocument = async (req, res) => {
  try {
    let text = "";
    let filename = "pasted-text.txt";
    let title = req.body.title || "Pasted Document";

    if (req.file) {
      filename = req.file.originalname;
      title = req.body.title || filename.replace(/\.[^/.]+$/, "");

      if (req.file.mimetype === "application/pdf") {
        const parsed = await pdfParse(req.file.buffer);
        text = parsed.text;
      } else {
        text = req.file.buffer.toString("utf8");
      }
    } else if (req.body.text) {
      text = req.body.text;
    }

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Missing document text content or upload file." });
    }

    // 1. Run Analyzer Agent to grade risk
    console.log(`Running risk analysis heuristics on document: "${title}"`);
    const analysis = analyzerAgent.analyzeContractText(text);

    // 2. Save Document to MongoDB
    const doc = new Document({
      title,
      filename,
      fileType: req.file && req.file.mimetype === "application/pdf" ? "pdf" : "txt",
      extractedText: text,
      riskScore: analysis.score,
      findings: analysis.findings,
      vectorSync: false,
      uploadedBy: req.user.id,
    });
    await doc.save();

    // 3. Sync to Vector DB
    try {
      console.log(`Indexing document "${title}" chunks into vector database...`);
      await vectorStoreService.addDocument(doc._id, doc.title, text);
      doc.vectorSync = true;
      await doc.save();
      console.log(`Successfully indexed document "${title}".`);
    } catch (vectorErr) {
      console.error("Vector sync failed on upload. Leaving unsynced for later retry.", vectorErr);
    }

    res.status(201).json(doc);
  } catch (err) {
    console.error("UploadDocument Error:", err);
    res.status(500).json({ error: "Failed to upload and audit document due to an internal error." });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const docs = await Document.find({ uploadedBy: req.user.id })
      .select("-extractedText")
      .sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    console.error("GetDocuments Error:", err);
    res.status(500).json({ error: "Failed to retrieve documents." });
  }
};

exports.getDocumentDetails = async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.docId,
      uploadedBy: req.user.id,
    });
    if (!doc) {
      return res.status(404).json({ error: "Document not found." });
    }
    res.json(doc);
  } catch (err) {
    console.error("GetDocumentDetails Error:", err);
    res.status(500).json({ error: "Failed to load document details." });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const docId = req.params.docId;
    const deleted = await Document.findOneAndDelete({
      _id: docId,
      uploadedBy: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Document not found or access denied." });
    }

    // Remove from vector database
    try {
      vectorStoreService.removeDocument(docId);
      console.log(`Removed document ${docId} from vector database.`);
    } catch (vectorErr) {
      console.error("Failed to remove document from vector index:", vectorErr);
    }

    res.json({ success: true, message: "Document deleted successfully." });
  } catch (err) {
    console.error("DeleteDocument Error:", err);
    res.status(500).json({ error: "Failed to delete document." });
  }
};

exports.reindexAllDocs = async (req, res) => {
  const dbSyncService = require("../services/dbSyncService");
  try {
    console.log("Triggering full re-indexing of all database records...");
    const result = await dbSyncService.reindexAll();
    res.json({ success: true, message: `Successfully re-indexed all records. Nodes re-built: ${result.reindexed}` });
  } catch (err) {
    console.error("Re-indexing API Error:", err);
    res.status(500).json({ error: "Failed to perform database re-indexing." });
  }
};
