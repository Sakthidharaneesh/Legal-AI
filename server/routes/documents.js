const express = require("express");
const router = express.Router();
const multer = require("multer");
const docController = require("../controllers/docController");
const { auth, adminOnly } = require("../middleware/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post("/upload", auth, upload.single("contractFile"), docController.uploadDocument);
router.get("/", auth, docController.getDocuments);
router.get("/:docId", auth, docController.getDocumentDetails);
router.delete("/:docId", auth, docController.deleteDocument);
router.post("/reindex", auth, adminOnly, docController.reindexAllDocs);

module.exports = router;
