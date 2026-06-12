require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const docRoutes = require("./routes/documents");
const complianceRoutes = require("./routes/compliance");
const statsRoutes = require("./routes/stats");
const alertsRoutes = require("./routes/alerts");
const templatesRoutes = require("./routes/templates");
const knowledgeBaseRoutes = require("./routes/knowledgeBase");
const contractCreatorRoutes = require("./routes/contractCreator");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Register API Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/documents", docRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/templates", templatesRoutes);
app.use("/api/knowledge-base", knowledgeBaseRoutes);
app.use("/api/contract-creator", contractCreatorRoutes);

// Register direct root endpoints for UI integration
const chatController = require("./controllers/chatController");
const docController = require("./controllers/docController");
const complianceController = require("./controllers/complianceController");
const { auth } = require("./middleware/auth");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.post("/chat", auth, async (req, res) => {
  // Use a single default session for direct root-level chats
  req.params.sessionId = "000000000000000000000001";
  await chatController.sendMessage(req, res);
});

// Streaming chat endpoint via Server-Sent Events
const workflowManager = require("./agents/workflowManager");
app.post("/chat/stream", auth, async (req, res) => {
  const { text, language, images } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required." });

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    // Fetch recent session messages for conversation memory
    let conversationHistory = [];
    try {
      const ChatSession = require("./models/chat");
      const sessionId = req.body.sessionId || "000000000000000000000001";
      const session = await ChatSession.findOne({ _id: sessionId, user: req.user.id });
      if (session && session.messages) {
        conversationHistory = session.messages.slice(-10).map(m => ({
          sender: m.sender,
          text: m.text ? m.text.substring(0, 600) : "",
        }));
      }
    } catch (_) { /* non-critical */ }

    const result = await workflowManager.runWorkflow(text, {
      language: language || "en",
      images: images || [],
      useKnowledgeBase: req.body.useKnowledgeBase !== false,
      conversationHistory,
    });

    // Save history to MongoDB session
    try {
      const ChatSession = require("./models/chat");
      const targetSessionId = req.body.sessionId || "000000000000000000000001";
      let session = await ChatSession.findOne({ _id: targetSessionId, user: req.user.id });
      if (!session && targetSessionId === "000000000000000000000001") {
        session = new ChatSession({
          _id: targetSessionId,
          user: req.user.id,
          sessionTitle: "Default Legal Chat Session",
          messages: [],
        });
      }
      if (session) {
        session.messages.push({
          sender: "user",
          text,
          images: images || [],
          attachedDocs: req.body.attachedDocs || [],
          timestamp: new Date(),
        });
        session.messages.push({
          sender: "agent",
          text: result.answer,
          reasoningChain: result.reasoningChain,
          sources: (result.sources || []).map(s => ({
            title: s.documentTitle || s.title || "Regulatory Reference",
            text: s.text || "",
            score: s.score || 0.8,
          })),
          timestamp: new Date(),
        });
        if (session.sessionTitle === "New Chat" || session.sessionTitle === "New Legal Chat Session" || session.sessionTitle === "Default Legal Chat Session") {
          session.sessionTitle = text.substring(0, 35) + "...";
        }
        await session.save();
      }
    } catch (dbErr) {
      console.error("[Stream DB Sync] Failed to save chat messages:", dbErr);
    }
    
    // Send reasoning chain events
    for (const step of result.reasoningChain) {
      res.write(`data: ${JSON.stringify({ type: "reasoning", step })}\n\n`);
    }

    // Stream the answer in chunks
    const words = result.answer.split(" ");
    let buffer = "";
    for (let i = 0; i < words.length; i++) {
      buffer += (i === 0 ? "" : " ") + words[i];
      if (i % 5 === 4 || i === words.length - 1) {
        res.write(`data: ${JSON.stringify({ type: "token", text: buffer })}\n\n`);
        buffer = "";
      }
    }

    // Send final result with sources and metadata
    res.write(`data: ${JSON.stringify({ type: "done", sources: result.sources, verdict: result.verdict, complianceGaps: result.complianceGaps })}\n\n`);
  } catch (err) {
    console.error("Stream Error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

app.get("/history", auth, async (req, res) => {
  const ChatSession = require("./models/chat");
  try {
    const session = await ChatSession.findOne({
      _id: "000000000000000000000001",
      user: req.user.id
    });
    if (!session) {
      return res.json([]);
    }
    res.json(session.messages);
  } catch (err) {
    console.error("GET /history Error:", err);
    res.status(500).json({ error: "Failed to retrieve chat history." });
  }
});

app.post("/upload", auth, upload.single("contractFile"), docController.uploadDocument);
app.post("/compliance", auth, complianceController.evaluateCompliance);

// Serves static page for quick deployment checks if needed
app.get("/health", (req, res) => {
  res.json({
    status: "online",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

// Serve frontend build folder in production if present
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/legal-ai";
console.log("Connecting to MongoDB at:", MONGO_URI);

const User = require("./models/user");
const seedDefaultUser = async () => {
  try {
    const email = "jane@firm.com";
    let defaultUser = await User.findOne({ email });
    if (!defaultUser) {
      defaultUser = new User({
        name: "Jane Doe",
        email,
        password: "defaultpassword123",
        role: "admin"
      });
      await defaultUser.save();
      console.log(`[🌱 SEED] Default user created: Jane Doe (${email})`);
    } else {
      console.log(`[🌱 SEED] Default user ${email} already exists.`);
    }
  } catch (err) {
    console.error("Failed to seed default user:", err);
  }
};

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB connection established successfully.");
    await seedDefaultUser();
    // Start Server
    app.listen(PORT, () => {
      console.log(`========================================================`);
      console.log(` Antigravity Legal AI Server active on port ${PORT}`);
      console.log(` Health check endpoint: http://localhost:${PORT}/health`);
      console.log(`========================================================`);
    });
  })
  .catch((err) => {
    console.error("CRITICAL: Failed to connect to MongoDB. Server halt.", err);
    process.exit(1);
  });
