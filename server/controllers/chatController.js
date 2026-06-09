const ChatSession = require("../models/chat");
const workflowManager = require("../agents/workflowManager");

exports.getSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user: req.user.id })
      .select("sessionTitle updatedAt createdAt")
      .sort({ updatedAt: -1 });
    res.json(sessions);
  } catch (err) {
    console.error("GetSessions Error:", err);
    res.status(500).json({ error: "Failed to load chat history sessions." });
  }
};

exports.getSessionDetails = async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.sessionId,
      user: req.user.id,
    });
    if (!session) {
      return res.status(404).json({ error: "Chat session not found." });
    }
    res.json(session);
  } catch (err) {
    console.error("GetSessionDetails Error:", err);
    res.status(500).json({ error: "Failed to load chat session details." });
  }
};

exports.createSession = async (req, res) => {
  const { title } = req.body;
  try {
    const session = new ChatSession({
      user: req.user.id,
      sessionTitle: title || "New Chat Session",
      messages: [],
    });
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    console.error("CreateSession Error:", err);
    res.status(500).json({ error: "Failed to create new chat session." });
  }
};

exports.sendMessage = async (req, res) => {
  const { sessionId } = req.params;
  const { text, settings } = req.body;

  try {
    if (!text) {
      return res.status(400).json({ error: "Missing message text." });
    }

    let session = await ChatSession.findOne({
      _id: sessionId,
      user: req.user.id,
    });

    if (!session) {
      // Create session on the fly if not exists
      session = new ChatSession({
        _id: sessionId,
        user: req.user.id,
        sessionTitle: text.substring(0, 30) + "...",
        messages: [],
      });
    }

    // 1. Add User Message
    const userMsg = {
      sender: "user",
      text,
      reasoningChain: [],
      sources: [],
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    // 2. Trigger Multi-Agent Graph Workflow
    console.log(`Running Agentic workflow for query: "${text}"`);
    const agentResult = await workflowManager.runWorkflow(text, settings || {});

    // 3. Add Agent Response Message
    const agentMsg = {
      sender: "agent",
      text: agentResult.answer,
      reasoningChain: agentResult.reasoningChain,
      sources: (agentResult.sources || []).map(s => ({
        title: s.documentTitle || s.title || "Regulatory Reference",
        text: s.text || "",
        score: s.score || 0.8,
      })),
      timestamp: new Date(),
    };
    session.messages.push(agentMsg);

    // Update session title if default
    if (session.sessionTitle === "New Chat Session" && session.messages.length <= 2) {
      session.sessionTitle = text.substring(0, 35) + "...";
    }

    await session.save();
    res.json({
      session,
      newMessage: agentMsg,
      verdict: agentResult.verdict,
    });
  } catch (err) {
    console.error("SendMessage Error:", err);
    res.status(500).json({ error: "Internal server error during agent chat routing." });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const deleted = await ChatSession.findOneAndDelete({
      _id: req.params.sessionId,
      user: req.user.id,
    });
    if (!deleted) {
      return res.status(404).json({ error: "Session not found." });
    }
    res.json({ success: true, message: "Session deleted." });
  } catch (err) {
    console.error("DeleteSession Error:", err);
    res.status(500).json({ error: "Failed to delete session." });
  }
};
