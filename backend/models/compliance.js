const mongoose = require("mongoose");

const ChecklistItemSchema = new mongoose.Schema({
  id: String,
  category: String,
  title: {
    type: String,
    required: true,
  },
  description: String,
  status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending",
  },
  severity: {
    type: String,
    enum: ["high", "medium", "low"],
    default: "medium",
  },
  regulationSource: String,
});

const ComplianceCheckSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  businessType: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  checklist: [ChecklistItemSchema],
  overallScore: {
    type: Number,
    default: 0, // Percentage of completed tasks
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ComplianceCheck", ComplianceCheckSchema);
