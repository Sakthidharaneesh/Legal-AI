/**
 * Mail Agent — LangGraph Node
 * Triggers AFTER the response node when the user requests email delivery.
 * Composes a rich HTML summary email covering:
 *   - AI response summary
 *   - Compliance gaps (framework + severity)
 *   - Retrieved sources
 *   - Risk score (if document analysis)
 *   - Confidence score
 */

const mailService = require("../services/mailService");

class MailAgent {
  /**
   * Compose and send an analysis summary email.
   * @param {object} payload { toEmail, userName, query, answer, complianceGaps, sources, confidenceScore, analysisResults, intent }
   */
  async sendSummary(payload) {
    const {
      toEmail,
      userName = "Legal AI User",
      query,
      answer,
      complianceGaps = [],
      sources = [],
      confidenceScore = null,
      analysisResults = null,
      intent = "chat",
    } = payload;

    if (!toEmail) throw new Error("toEmail is required");

    console.log(`[Mail Agent] Composing summary email to ${toEmail} | Intent: ${intent}`);

    const html = this._buildHtml({ userName, query, answer, complianceGaps, sources, confidenceScore, analysisResults, intent });
    const subject = this._buildSubject(intent, analysisResults, complianceGaps);

    // Delegate to mailService transport
    const result = await mailService.sendGeneral(toEmail, subject, html);
    console.log(`[Mail Agent] Email dispatched → ${toEmail} | Success: ${result.success}`);
    return result;
  }

  _buildSubject(intent, analysisResults, complianceGaps) {
    if (intent === "analysis" && analysisResults?.score != null) {
      const status = analysisResults.score < 50 ? "⚠️ HIGH RISK" : analysisResults.score < 80 ? "🟡 REVIEW NEEDED" : "✅ CLEAR";
      return `[Legal AI] Document Analysis Report — Risk Score ${analysisResults.score}/100 ${status}`;
    }
    if (intent === "compliance") {
      const highCount = complianceGaps.filter(g => g.severity === "high").length;
      return `[Legal AI] Compliance Report — ${highCount} Critical Gap${highCount !== 1 ? "s" : ""} Found`;
    }
    return `[Legal AI] Analysis Summary — ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  }

  _buildHtml({ userName, query, answer, complianceGaps, sources, confidenceScore, analysisResults, intent }) {
    const colors = { high: "#ef4444", medium: "#f59e0b", low: "#3b82f6" };
    const bgColors = { high: "#fef2f2", medium: "#fffbeb", low: "#eff6ff" };

    // Score badge
    const scoreSection = analysisResults?.score != null ? `
      <div style="text-align:center;background:#f9fafb;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #e5e7eb;">
        <div style="font-size:13px;color:#6b7280;margin-bottom:4px;">Document Risk Score</div>
        <div style="font-size:48px;font-weight:800;color:${analysisResults.score < 50 ? "#ef4444" : analysisResults.score < 80 ? "#f59e0b" : "#10b981"};">
          ${analysisResults.score}<span style="font-size:20px;font-weight:500;color:#9ca3af;">/100</span>
        </div>
        <div style="font-size:12px;font-weight:700;letter-spacing:0.05em;color:${analysisResults.score < 50 ? "#ef4444" : analysisResults.score < 80 ? "#d97706" : "#059669"};">
          ${analysisResults.score < 50 ? "CRITICAL — IMMEDIATE REVIEW NEEDED" : analysisResults.score < 80 ? "ATTENTION REQUIRED" : "COMPLIANCE CLEAR"}
        </div>
      </div>` : "";

    // Confidence badge
    const confSection = confidenceScore != null ? `
      <div style="display:inline-block;background:${confidenceScore >= 70 ? "#ecfdf5" : "#fffbeb"};border:1px solid ${confidenceScore >= 70 ? "#6ee7b7" : "#fcd34d"};border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600;color:${confidenceScore >= 70 ? "#065f46" : "#92400e"};">
        AI Confidence: ${confidenceScore}%
      </div>` : "";

    // Query card
    const querySection = `
      <div style="background:#f3f4f6;border-radius:8px;padding:14px 16px;margin:16px 0;border-left:4px solid #6366f1;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6366f1;margin-bottom:6px;">Your Query</div>
        <div style="font-size:14px;color:#1f2937;font-style:italic;">"${query?.substring(0, 200)}${query?.length > 200 ? "..." : ""}"</div>
      </div>`;

    // AI answer (truncated for email)
    const answerSection = `
      <div style="margin:16px 0;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#374151;margin-bottom:8px;">AI Analysis Summary</div>
        <div style="font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;">
          ${(answer || "").substring(0, 1800).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/#{1,3} (.*)/g, "<strong style='font-size:15px;'>$1</strong>").replace(/\n/g, "<br/>")}
          ${(answer || "").length > 1800 ? "<br/><em style='color:#9ca3af;font-size:12px;'>... [full response truncated — view in Legal AI platform]</em>" : ""}
        </div>
      </div>`;

    // Compliance gaps
    const gapsSection = complianceGaps.length > 0 ? `
      <div style="margin:20px 0;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#374151;border-bottom:2px solid #ef4444;padding-bottom:6px;margin-bottom:12px;">
          ⚠️ Compliance Gaps (${complianceGaps.length})
        </div>
        ${complianceGaps.map(g => `
          <div style="border-left:4px solid ${colors[g.severity] || "#6b7280"};background:${bgColors[g.severity] || "#f9fafb"};border-radius:6px;padding:10px 14px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong style="font-size:13px;color:#1f2937;">${g.requirement}</strong>
              <span style="font-size:10px;font-weight:700;text-transform:uppercase;background:${colors[g.severity] || "#6b7280"};color:#fff;border-radius:10px;padding:2px 8px;">${g.severity}</span>
            </div>
            <div style="font-size:11px;font-weight:600;color:${colors[g.severity] || "#6b7280"};margin-bottom:4px;">[${g.framework}]</div>
            <div style="font-size:13px;color:#4b5563;line-height:1.5;">${g.details}</div>
          </div>`).join("")}
      </div>` : `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center;">
        <span style="color:#15803d;font-weight:600;font-size:14px;">✅ No critical compliance gaps identified</span>
      </div>`;

    // Sources
    const sourcesSection = sources.length > 0 ? `
      <div style="margin:20px 0;">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#374151;margin-bottom:10px;">📚 Knowledge Base Sources Used (${sources.length})</div>
        ${sources.slice(0, 4).map((s, i) => `
          <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;margin-bottom:6px;background:#f9fafb;">
            <div style="font-size:13px;font-weight:600;color:#1f2937;">[${i + 1}] ${s.documentTitle || s.title || "Regulatory Reference"}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">${(s.text || "").substring(0, 120)}...</div>
          </div>`).join("")}
      </div>` : "";

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#3730a3 100%);padding:28px 32px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">⚖️ Legal AI</div>
          <div style="font-size:13px;color:#c7d2fe;margin-top:4px;">Analysis Summary Report</div>
          <div style="font-size:11px;color:#a5b4fc;margin-top:8px;">${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <p style="font-size:16px;color:#1f2937;margin:0 0 16px;">Hello <strong>${userName}</strong>,</p>
          <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
            Your Legal AI analysis is complete. Here is the full summary of findings, compliance gaps, and recommendations.
          </p>

          ${confSection}
          ${scoreSection}
          ${querySection}
          ${answerSection}
          ${gapsSection}
          ${sourcesSection}

          <!-- Footer -->
          <div style="border-top:1px solid #e5e7eb;margin-top:28px;padding-top:20px;text-align:center;">
            <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">
              This is an automated report from <strong>Antigravity Legal AI</strong>.<br/>
              AI-generated content is for informational purposes only and does not constitute legal advice.<br/>
              Please consult a qualified legal professional for binding legal matters.
            </p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}

module.exports = new MailAgent();
