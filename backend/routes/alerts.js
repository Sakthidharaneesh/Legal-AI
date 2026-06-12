const express = require("express");
const router = express.Router();
const alertsController = require("../controllers/alertsController");
const { auth } = require("../middleware/auth");

router.get("/", auth, alertsController.getAlerts);
router.put("/:id/acknowledge", auth, alertsController.acknowledgeAlert);

module.exports = router;
