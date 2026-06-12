const Document = require("../models/document");
const analyzerAgent = require("../agents/analyzerAgent");
const vectorStoreService = require("../services/vectorStoreService");
const { parseFileBuffer } = require("../utils/fileParser");

exports.uploadDocument = async (req, res) => {
  try {
    let text = "";
    let filename = "pasted-text.txt";
    let title = req.body.title || "Pasted Document";
    let detectedType = "txt";

    if (req.file) {
      filename = req.file.originalname;
      title = req.body.title || filename.replace(/\.[^/.]+$/, "");
      detectedType = filename.split(".").pop().toLowerCase() || "txt";

      text = await parseFileBuffer(req.file.buffer, filename, req.file.mimetype);
    } else if (req.body.text) {
      text = req.body.text;
    }

    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Missing or unextractable text content in the file." });
    }

    // 1. Run Analyzer Agent to grade risk
    console.log(`Running risk analysis on document: "${title}"`);
    const analysis = await analyzerAgent.analyzeContractTextAsync(text);

    // 2. Save Document to MongoDB
    const doc = new Document({
      title,
      filename,
      fileType: detectedType,
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

    // 4. Send Analysis Summary Email (async)
    try {
      const User = require("../models/user");
      const user = await User.findById(req.user.id);
      if (user && user.email) {
        const mailService = require("../services/mailService");
        mailService.sendAnalysisSummary(user.email, user.name, {
          title: doc.title,
          riskScore: doc.riskScore,
          findings: doc.findings,
        }).catch(err => console.error("Async email dispatch failed:", err));
      }
    } catch (emailErr) {
      console.error("Failed to query user for email dispatch:", emailErr);
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
