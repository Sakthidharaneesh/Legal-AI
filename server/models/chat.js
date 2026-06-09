const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ["user", "agent"],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  reasoningChain: [
    {
      type: {
        type: String, // 'thought', 'tool', 'observation', etc.
        required: true,
      },
      name: String,   // name of tool or step
      text: String,   // detailed log text
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  sources: [
    {
      title: String,
      text: String,
      score: Number,
    },
  ],
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ChatSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sessionTitle: {
    type: String,
    default: "New Legal Chat Session",
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
ChatSessionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("ChatSession", ChatSessionSchema);
