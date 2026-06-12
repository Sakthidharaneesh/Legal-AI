const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { auth } = require("../middleware/auth");

router.get("/sessions", auth, chatController.getSessions);
router.post("/sessions", auth, chatController.createSession);
router.get("/sessions/:sessionId", auth, chatController.getSessionDetails);
router.post("/sessions/:sessionId/messages", auth, chatController.sendMessage);
router.post("/sessions/:sessionId/send-summary", auth, chatController.sendSummary);
router.delete("/sessions/:sessionId", auth, chatController.deleteSession);

module.exports = router;
