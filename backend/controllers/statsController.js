const ChatSession = require("../models/chat");
const Document = require("../models/document");
const ComplianceCheck = require("../models/compliance");
const User = require("../models/user");

exports.getStats = async (req, res) => {
  try {
    const [docCount, chatCount, complianceCount, userCount] = await Promise.all([
      Document.countDocuments(),
      ChatSession.countDocuments(),
      ComplianceCheck.countDocuments(),
      User.countDocuments(),
    ]);

    // Calculate average risk score
    const docs = await Document.find({}, "riskScore createdAt");
    const avgRisk = docs.length > 0
      ? Math.round(docs.reduce((sum, d) => sum + (d.riskScore || 0), 0) / docs.length)
      : 0;

    // Get recent activity
    const recentDocs = await Document.find().sort({ createdAt: -1 }).limit(3).lean();
    const recentChats = await ChatSession.find().sort({ updatedAt: -1 }).limit(3).lean();
    const recentCompliance = await ComplianceCheck.find().sort({ createdAt: -1 }).limit(3).lean();

    const recentActivity = [];
    
    recentDocs.forEach(d => {
      recentActivity.push({
        type: "document",
        title: `${d.title || d.filename} analyzed`,
        time: d.createdAt,
        tag: "Document"
      });
    });
    
    recentChats.forEach(c => {
      const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
      recentActivity.push({
        type: "chat",
        title: lastMsg && lastMsg.text ? `Asked: "${lastMsg.text.substring(0, 50)}..."` : "Chat session created",
        time: c.updatedAt || c.createdAt,
        tag: "Chat"
      });
    });

    recentCompliance.forEach(c => {
      recentActivity.push({
        type: "compliance",
        title: `${c.businessType || "General"} compliance check (${c.country || "Global"})`,
        time: c.createdAt,
        tag: "Compliance"
      });
    });

    // Sort by time descending
    recentActivity.sort((a, b) => new Date(b.time) - new Date(a.time));

    // Weekly activity data (last 7 days)
    const weekActivity = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayDocs = await Document.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });
      const dayChats = await ChatSession.countDocuments({
        createdAt: { $gte: date, $lt: nextDate }
      });

      weekActivity.push({
        day: days[date.getDay()],
        queries: dayDocs + dayChats
      });
    }

    res.json({
      documents: docCount,
      conversations: chatCount,
      complianceChecks: complianceCount,
      users: userCount,
      averageRiskScore: avgRisk,
      recentActivity: recentActivity.slice(0, 10),
      weekActivity
    });
  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).json({ error: "Failed to retrieve stats." });
  }
};
