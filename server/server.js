require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const docRoutes = require("./routes/documents");
const complianceRoutes = require("./routes/compliance");

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
  app.use(express.static(path.join(__dirname, "../client/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist/index.html"));
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
