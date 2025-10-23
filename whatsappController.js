/**
 * --------------------------------------------------------------------------
 * 📱 WhatsApp SEO Report Controller
 * --------------------------------------------------------------------------
 * Sends formatted SEO audit reports via WhatsApp API.
 * Includes audit limits per IP, multiple recipient handling, 
 * and structured emoji-rich report formatting.
 * --------------------------------------------------------------------------
 */

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/* -------------------------------------------------------------------------- */
/* 🧩 CONFIGURATION */
/* -------------------------------------------------------------------------- */

const CONFIG = {
  ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
  INSTANCE_ID: process.env.WHATSAPP_INSTANCE_ID,
  API_BASE_URL:
    process.env.WHATSAPP_API_URL || "https://app.simplywhatsapp.com/api",
  AUDIT_LIMIT: 3,
  RESET_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
};

const auditCounts = new Map();
setInterval(() => auditCounts.clear(), CONFIG.RESET_INTERVAL);

/* -------------------------------------------------------------------------- */
/* 🛠️ UTILITY FUNCTIONS */
/* -------------------------------------------------------------------------- */

/**
 * Formats and validates a phone number into international format.
 */
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return null;
  const clean = phoneNumber.toString().replace(/\D/g, "");
  if (clean.length < 10 || clean.length > 15) return null;
  if (clean.length > 10) return clean;
  if (clean.length === 10 && /^[6789]/.test(clean)) return "91" + clean;
  if (clean.length === 11 && clean.startsWith("0")) return "91" + clean.slice(1);
  return clean;
};

/**
 * Returns emoji and label for a score range.
 */
const getScoreRating = (score) => {
  if (score >= 90) return { label: "Excellent", emoji: "🟢" };
  if (score >= 75) return { label: "Good", emoji: "🟡" };
  if (score >= 50) return { label: "Average", emoji: "🟠" };
  if (score > 0) return { label: "Poor", emoji: "🔴" };
  return { label: "N/A", emoji: "⚪" };
};

/**
 * Evaluates a given metric (like LCP, CLS, etc.) for quality rating.
 */
const evaluateMetric = (metric, value) => {
  switch (metric) {
    case "fcp":
    case "lcp":
    case "speedIndex":
    case "tti":
      if (value <= 2.5) return { label: "Excellent", emoji: "🟢" };
      if (value <= 4) return { label: "Good", emoji: "🟡" };
      if (value <= 6) return { label: "Needs Improvement", emoji: "🟠" };
      return { label: "Poor", emoji: "🔴" };
    case "cls":
      if (value <= 0.1) return { label: "Excellent", emoji: "🟢" };
      if (value <= 0.25) return { label: "Good", emoji: "🟡" };
      if (value <= 0.5) return { label: "Needs Improvement", emoji: "🟠" };
      return { label: "Poor", emoji: "🔴" };
    case "tbt":
      if (value <= 200) return { label: "Excellent", emoji: "🟢" };
      if (value <= 400) return { label: "Good", emoji: "🟡" };
      if (value <= 600) return { label: "Needs Improvement", emoji: "🟠" };
      return { label: "Poor", emoji: "🔴" };
    default:
      return { label: "N/A", emoji: "⚪" };
  }
};

/**
 * Calculates pass rate percentage based on issue counts.
 */
const calculatePassRate = (issues) => {
  const total = (issues.critical || 0) + (issues.warning || 0) + (issues.passed || 0);
  return total > 0 ? Math.round((issues.passed / total) * 100) : 100;
};

/**
 * Returns an overall health status summary.
 */
const getHealthStatus = (issues) => {
  const totalIssues = (issues.critical || 0) + (issues.warning || 0);
  if (issues.critical > 5) return "🚨 High Risk";
  if (issues.critical > 0) return "⚠️ Moderate Risk";
  if (totalIssues === 0) return "✅ Excellent Health";
  return "🟡 Needs Improvement";
};

/**
 * Formats current timestamp.
 */
const formatTimestamp = () =>
  new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

/* -------------------------------------------------------------------------- */
/* 🧾 MESSAGE BUILDER */
/* -------------------------------------------------------------------------- */

/**
 * Builds the WhatsApp-friendly SEO report message.
 */
const formatSEOReportMessage = (reportData) => {
  const {
    url = "N/A",
    email = "N/A",
    overallScore = 0,
    mobileScore = 0,
    desktopScore = 0,
    seoScore = 0,
    accessibilityScore = 0,
    bestPracticesScore = 0,
    performanceScore = overallScore,
    metrics = {},
    issues = { critical: 0, warning: 0, passed: 0 },
    recommendations = [],
    timestamp = formatTimestamp(),
  } = reportData;

  const { fcp = 0, lcp = 0, cls = 0, speedIndex = 0, tti = 0, tbt = 0 } = metrics;

  const sections = [];

  // HEADER
  sections.push(
    `🚀 *COMPREHENSIVE SEO AUDIT REPORT*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🌐 *Website:* ${url}\n📧 *Contact:* ${email}\n📊 *Status:* ${getHealthStatus(
        issues
      )}\n📅 *Generated:* ${timestamp}`
  );

  // PERFORMANCE
  sections.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n*📊 PERFORMANCE OVERVIEW*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🧩 *Overall:* ${overallScore}/100 _(${getScoreRating(overallScore).label})_\n` +
      `⚡ *Performance:* ${performanceScore}/100 _(${getScoreRating(performanceScore).label})_\n` +
      `📱 *Mobile:* ${mobileScore}/100 _(${getScoreRating(mobileScore).label})_\n` +
      `💻 *Desktop:* ${desktopScore}/100 _(${getScoreRating(desktopScore).label})_`
  );

  // METRICS
  sections.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n*🎯 CORE METRICS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🔍 *SEO:* ${seoScore}/100 _(${getScoreRating(seoScore).label})_\n` +
      `♿ *Accessibility:* ${accessibilityScore}/100 _(${getScoreRating(accessibilityScore).label})_\n` +
      `🧠 *Best Practices:* ${bestPracticesScore}/100 _(${getScoreRating(bestPracticesScore).label})_`
  );

  // WEB VITALS
  sections.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n*⚡ CORE WEB VITALS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⏱️ *FCP:* ${fcp.toFixed(2)}s _(${evaluateMetric("fcp", fcp).label})_\n` +
      `📏 *LCP:* ${lcp.toFixed(2)}s _(${evaluateMetric("lcp", lcp).label})_\n` +
      `🌀 *CLS:* ${cls.toFixed(3)} _(${evaluateMetric("cls", cls).label})_\n` +
      `🏎️ *Speed Index:* ${speedIndex.toFixed(2)}s _(${evaluateMetric("speedIndex", speedIndex).label})_\n` +
      `🕐 *TTI:* ${tti.toFixed(2)}s _(${evaluateMetric("tti", tti).label})_\n` +
      `🚧 *TBT:* ${tbt.toFixed(0)}ms _(${evaluateMetric("tbt", tbt).label})_`
  );

  // ISSUES
  const totalIssues = (issues.critical || 0) + (issues.warning || 0);
  sections.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n*🔍 ISSUES SUMMARY*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${issues.critical ? "🔴" : "✅"} *Critical:* ${issues.critical}\n` +
      `${issues.warning ? "🟡" : "✅"} *Warnings:* ${issues.warning}\n` +
      `🟢 *Passed:* ${issues.passed}\n📈 *Pass Rate:* ${calculatePassRate(issues)}%\n📊 *Total:* ${totalIssues}`
  );

  // RECOMMENDATIONS
  if (recommendations.length) {
    const top = recommendations
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r}`)
      .join("\n");
    sections.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━\n*💡 TOP RECOMMENDATIONS*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${top}`);
  }

  // FOOTER
  sections.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✨ _Professional SEO Audit by Marketiq Junction_\n` +
      `📞 *Need help?* Reply to discuss optimization strategies!\n🌐 Let's elevate your digital presence together.`
  );

  return sections.join("\n\n");
};

/* -------------------------------------------------------------------------- */
/* 🚀 MAIN CONTROLLER */
/* -------------------------------------------------------------------------- */

/**
 * Handles WhatsApp SEO report sending.
 */
export const sendWhatsAppReport = async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || "unknown";
    const count = auditCounts.get(clientIP) || 0;

    // Rate limit check
    if (count >= CONFIG.AUDIT_LIMIT) {
      return res.status(429).json({
        success: false,
        message: `Audit limit exceeded. Max ${CONFIG.AUDIT_LIMIT} per 24 hours.`,
        limit: CONFIG.AUDIT_LIMIT,
        current: count,
      });
    }

    let { phoneNumbers, reportData } = req.body;
    if (!phoneNumbers && req.body.phoneNumber) phoneNumbers = [req.body.phoneNumber];

    // Input validation
    if (!phoneNumbers?.length || !reportData) {
      return res.status(400).json({
        success: false,
        message: "Phone numbers and report data are required.",
      });
    }

    if (phoneNumbers.length > 3) {
      return res.status(400).json({
        success: false,
        message: "Limit exceeded: Maximum 3 phone numbers allowed per request.",
      });
    }

    if (!CONFIG.ACCESS_TOKEN || !CONFIG.INSTANCE_ID) {
      console.error("WhatsApp credentials missing");
      return res.status(500).json({
        success: false,
        message: "WhatsApp service not configured.",
      });
    }

    const messageText = formatSEOReportMessage(reportData);
    const results = [];

    for (const number of phoneNumbers) {
      const formatted = formatPhoneNumber(number);
      if (!formatted) {
        results.push({ phoneNumber: number, success: false, error: "Invalid phone number." });
        continue;
      }

      try {
        const payload = {
          number: formatted,
          type: "text",
          message: messageText,
          instance_id: CONFIG.INSTANCE_ID,
          access_token: CONFIG.ACCESS_TOKEN,
        };

        const response = await axios.post(`${CONFIG.API_BASE_URL}/send`, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
          validateStatus: (status) => status < 500,
        });

        if (response.data.status === "error" || response.status >= 400) {
          results.push({
            phoneNumber: formatted,
            success: false,
            error: response.data.message || "WhatsApp API error",
          });
        } else {
          results.push({
            phoneNumber: formatted,
            success: true,
            messageId: response.data.message_id || null,
          });
        }
      } catch (err) {
        results.push({
          phoneNumber: formatted,
          success: false,
          error: err.message || "Request failed",
        });
      }
    }

    auditCounts.set(clientIP, count + 1);

    res.status(200).json({
      success: true,
      message: "WhatsApp reports sent successfully.",
      results,
      limit: CONFIG.AUDIT_LIMIT,
      auditsRemaining: CONFIG.AUDIT_LIMIT - (count + 1),
    });
  } catch (err) {
    console.error("WhatsApp sending failed:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
