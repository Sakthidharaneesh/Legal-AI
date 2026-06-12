const express = require("express");
const router = express.Router();
const templatesController = require("../controllers/templatesController");
const { auth } = require("../middleware/auth");

router.get("/", auth, templatesController.getTemplates);

module.exports = router;
