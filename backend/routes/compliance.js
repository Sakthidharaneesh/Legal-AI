const express = require("express");
const router = express.Router();
const complianceController = require("../controllers/complianceController");
const { auth } = require("../middleware/auth");

router.post("/evaluate", auth, complianceController.evaluateCompliance);
router.get("/history", auth, complianceController.getComplianceHistory);
router.put("/checks/:checkId/items/:itemId", auth, complianceController.updateComplianceItemStatus);

module.exports = router;
