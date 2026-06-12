const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const contractCreatorController = require("../controllers/contractCreatorController");

// Generate a full contract draft based on type + parameters
router.post("/generate", auth, contractCreatorController.generateContract);

// Get AI clause suggestions for a specific section
router.post("/suggest-clause", auth, contractCreatorController.suggestClause);

// Validate a drafted contract against regulations
router.post("/validate", auth, contractCreatorController.validateContract);

module.exports = router;
