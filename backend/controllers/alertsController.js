const { REGULATORY_ALERTS } = require("../mockData");

// In-memory acknowledged state (persists per server session)
const acknowledged = new Set();

exports.getAlerts = async (req, res) => {
  try {
    const alerts = REGULATORY_ALERTS.map(a => ({
      ...a,
      acknowledged: acknowledged.has(a.id)
    }));
    res.json(alerts);
  } catch (err) {
    console.error("Alerts Error:", err);
    res.status(500).json({ error: "Failed to retrieve alerts." });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    acknowledged.add(id);
    res.json({ success: true, id });
  } catch (err) {
    console.error("Acknowledge Error:", err);
    res.status(500).json({ error: "Failed to acknowledge alert." });
  }
};
