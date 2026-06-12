const mongoose = require("mongoose");

const RiskFindingSchema = new mongoose.Schema({
  id: String,
  clause: {
    type: String,
    required: true,
  },
  severity: {
    type: String,
    enum: ["high", "medium", "low"],
    required: true,
  },
  findingType: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    required: true,
  },
  suggestedRewrite: {
    type: String,
    required: true,
  },
});

const DocumentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  filename: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    default: "pdf",
  },
  extractedText: {
    type: String,
    required: true,
  },
  riskScore: {
    type: Number,
    default: 0,
  },
  findings: [RiskFindingSchema],
  vectorSync: {
    type: Boolean,
    default: false,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Document", DocumentSchema);
