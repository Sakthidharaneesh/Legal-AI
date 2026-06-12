const express = require("express");
const router = express.Router();
const kbController = require("../controllers/knowledgeBaseController");
const { auth, adminOnly } = require("../middleware/auth");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.get("/", auth, kbController.listArticles);
router.post("/", auth, kbController.addArticle);
router.post("/upload", auth, upload.single("kbFile"), kbController.uploadDocument);
router.delete("/:id", auth, kbController.deleteArticle);
router.post("/search", auth, kbController.search);
router.post("/flush", auth, adminOnly, kbController.flush);

module.exports = router;
