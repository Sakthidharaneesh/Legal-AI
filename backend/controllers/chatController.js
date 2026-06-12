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
  const { text, settings, language, images } = req.body;

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
      images: images || [],
      attachedDocs: req.body.attachedDocs || [],
      reasoningChain: [],
      sources: [],
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    // 2. Trigger Multi-Agent Graph Workflow
    console.log(`Running Agentic workflow for query: "${text}"`);
    const agentResult = await workflowManager.runWorkflow(text, { language, images: images || [], ...settings });

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

exports.sendSummary = async (req, res) => {
  const { sessionId } = req.params;
  const { toEmail, messageId } = req.body;

  try {
    const session = await ChatSession.findOne({ _id: sessionId, user: req.user.id });
    if (!session) {
      return res.status(404).json({ error: "Chat session not found." });
    }

    // Find the latest agent message or the specific one by messageId
    let targetMessage = null;
    if (messageId) {
      targetMessage = session.messages.find(m => m._id.toString() === messageId && m.sender === "agent");
    } else {
      // Get the latest agent message
      for (let i = session.messages.length - 1; i >= 0; i--) {
        if (session.messages[i].sender === "agent") {
          targetMessage = session.messages[i];
          break;
        }
      }
    }

    if (!targetMessage) {
      return res.status(400).json({ error: "No agent response message found to summarize." });
    }

    // Find corresponding user query (typically the message before the target agent message)
    let userQuery = "Legal AI Inquiry";
    const msgIndex = session.messages.findIndex(m => m._id.toString() === targetMessage._id.toString());
    if (msgIndex > 0 && session.messages[msgIndex - 1].sender === "user") {
      userQuery = session.messages[msgIndex - 1].text;
    }

    const emailToSend = toEmail || req.user.email;
    if (!emailToSend) {
      return res.status(400).json({ error: "Destination email address is required." });
    }

    const User = require("../models/user");
    const user = await User.findById(req.user.id);
    const userName = user ? user.name : "Legal AI User";

    const mailAgent = require("../agents/mailAgent");

    // Extract gaps from reasoning chain or database
    const complianceGaps = [];
    // If the message has reasoning logs, try to map gaps
    targetMessage.reasoningChain?.forEach(step => {
      if (step.name === "Compliance Agent" && step.type === "observation") {
        // We can parse the text if it lists gaps, or simply rely on database.
      }
    });

    const result = await mailAgent.sendSummary({
      toEmail: emailToSend,
      userName,
      query: userQuery,
      answer: targetMessage.text,
      complianceGaps, // will fetch database items or fall back to template rules
      sources: targetMessage.sources.map(s => ({
        documentTitle: s.title,
        text: s.text,
        score: s.score
      })),
      confidenceScore: 85, // estimated confidence
      intent: "chat"
    });

    res.json({
      success: true,
      message: `Summary email sent successfully to ${emailToSend}.`,
      url: result.url
    });
  } catch (err) {
    console.error("SendSummary Email Error:", err);
    res.status(500).json({ error: "Failed to send email summary. Check SMTP configurations." });
  }
};
