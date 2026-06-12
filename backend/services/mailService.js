const nodemailer = require("nodemailer");

class MailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  async initTransporter() {
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        console.log("[Mail Service] Configured SMTP transporter successfully.");
      } else {
        // Create an Ethereal test account for dev mode
        nodemailer.createTestAccount((err, account) => {
          if (err) {
            console.warn("[Mail Service] Failed to create Ethereal test account. Falling back to log-only mode.", err.message);
            return;
          }
          this.transporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
              user: account.user,
              pass: account.pass,
            },
          });
          console.log(`[Mail Service] Ethereal development mailer active. Test credentials: User: ${account.user}`);
          this.etherealAccount = account;
        });
      }
    } catch (err) {
      console.error("[Mail Service] Initialization failed:", err);
    }
  }

  /**
   * Send analysis summary email to user
   * @param {string} toEmail 
   * @param {string} userName 
   * @param {object} docDetails { title, riskScore, findings }
   */
  async sendAnalysisSummary(toEmail, userName, docDetails) {
    const { title, riskScore, findings } = docDetails;

    // Compile findings lists
    const highRisks = findings.filter(f => f.severity === "high");
    const mediumRisks = findings.filter(f => f.severity === "medium");
    const lowRisks = findings.filter(f => f.severity === "low");

    const highRisksHtml = highRisks.map(f => `
      <div style="border-left: 4px solid #ef4444; padding-left: 10px; margin-bottom: 12px; background-color: #fef2f2; padding-top: 6px; padding-bottom: 6px; border-radius: 4px;">
        <strong style="color: #b91c1c;">${f.findingType} (HIGH RISK)</strong><br/>
        <span style="font-size: 13px; color: #4b5563;"><strong>Clause:</strong> "${f.clause}"</span><br/>
        <span style="font-size: 13px; color: #1f2937;"><strong>Details:</strong> ${f.details}</span><br/>
        <span style="font-size: 13px; color: #047857;"><strong>Suggested Rewrite:</strong> "${f.suggestedRewrite}"</span>
      </div>
    `).join("") || "<p style='color: #6b7280;'>No high risk clauses detected.</p>";

    const mediumRisksHtml = mediumRisks.map(f => `
      <div style="border-left: 4px solid #f59e0b; padding-left: 10px; margin-bottom: 12px; background-color: #fffbeb; padding-top: 6px; padding-bottom: 6px; border-radius: 4px;">
        <strong style="color: #b45309;">${f.findingType} (MEDIUM RISK)</strong><br/>
        <span style="font-size: 13px; color: #4b5563;"><strong>Clause:</strong> "${f.clause}"</span><br/>
        <span style="font-size: 13px; color: #1f2937;"><strong>Details:</strong> ${f.details}</span><br/>
        <span style="font-size: 13px; color: #047857;"><strong>Suggested Rewrite:</strong> "${f.suggestedRewrite}"</span>
      </div>
    `).join("") || "<p style='color: #6b7280;'>No medium risk clauses detected.</p>";

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="text-align: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 20px;">
          <h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">Antigravity Legal AI</h1>
          <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px;">Contract Audit & Compliance Assessment</p>
        </div>
        
        <p style="font-size: 16px; color: #1f2937;">Hello <strong>${userName}</strong>,</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
          Your document <strong>"${title}"</strong> has been audited and indexed. Here is a summary of the compliance and risk findings.
        </p>

        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
          <span style="font-size: 14px; color: #4b5563;">Document Audit Score</span>
          <h2 style="font-size: 36px; margin: 5px 0; color: ${riskScore < 50 ? '#ef4444' : riskScore < 80 ? '#f59e0b' : '#10b981'};">${riskScore}/100</h2>
          <span style="font-size: 12px; font-weight: 600; color: ${riskScore < 50 ? '#ef4444' : riskScore < 80 ? '#d97706' : '#059669'};">
            ${riskScore < 50 ? 'CRITICAL - IMMEDIATE REVIEW NEEDED' : riskScore < 80 ? 'ATTENTION REQUIRED' : 'COMPLIANCE CLEAR'}
          </span>
        </div>

        <h3 style="color: #111827; border-bottom: 2px solid #ef4444; padding-bottom: 4px; font-size: 16px;">High Severity Risks (${highRisks.length})</h3>
        ${highRisksHtml}

        <h3 style="color: #111827; border-bottom: 2px solid #f59e0b; padding-bottom: 4px; font-size: 16px; margin-top: 25px;">Medium Severity Risks (${mediumRisks.length})</h3>
        ${mediumRisksHtml}

        <p style="font-size: 12px; color: #9ca3af; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px; text-align: center;">
          This is an automated compliance report generated by Antigravity Legal AI. Please consult legal counsel before executing contract amendments.
        </p>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Antigravity Legal AI" <noreply@legalai.com>',
      to: toEmail,
      subject: `[Audit Summary] ${title} - Risk Score: ${riskScore}/100`,
      html: emailHtml,
    };

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[Mail Service] Email sent successfully: ${info.messageId}`);
        if (this.etherealAccount) {
          console.log(`[Mail Service] View test email at: ${nodemailer.getTestMessageUrl(info)}`);
        }
        return { success: true, messageId: info.messageId, url: this.etherealAccount ? nodemailer.getTestMessageUrl(info) : null };
      } catch (err) {
        console.error("[Mail Service] Failed to send email via transporter:", err);
      }
    }

    // Console logging fallback if transporter is unavailable
    console.log("======================================== MOCK MAIL SUMMARY ========================================");
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Body: Document "${title}" has score ${riskScore}/100. High risks: ${highRisks.length}, Medium risks: ${mediumRisks.length}.`);
    console.log("===================================================================================================");
    return { success: true, logOnly: true };
  }

  /**
   * Send a general HTML email
   * @param {string} toEmail 
   * @param {string} subject 
   * @param {string} html 
   */
  async sendGeneral(toEmail, subject, html) {
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Antigravity Legal AI" <noreply@legalai.com>',
      to: toEmail,
      subject: subject,
      html: html,
    };

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[Mail Service] Email sent successfully: ${info.messageId}`);
        if (this.etherealAccount) {
          console.log(`[Mail Service] View test email at: ${nodemailer.getTestMessageUrl(info)}`);
        }
        return { success: true, messageId: info.messageId, url: this.etherealAccount ? nodemailer.getTestMessageUrl(info) : null };
      } catch (err) {
        console.error("[Mail Service] Failed to send email via transporter:", err);
      }
    }

    console.log("======================================== MOCK MAIL GENERAL ========================================");
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log("Body: [HTML Content]");
    console.log("===================================================================================================");
    return { success: true, logOnly: true };
  }
}

module.exports = new MailService();
