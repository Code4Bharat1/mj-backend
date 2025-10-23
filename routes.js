import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { sendWhatsAppReport } from "./whatsappController.js";

dotenv.config();

const router = express.Router();

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PAGESPEED_API_KEY;

// ✅ PageSpeed API endpoint with retry logic
router.post("/pagespeed/run", async (req, res) => {
  try {
    const { url, strategy } = req.body;

    // Validate input
    if (!url || !strategy) {
      return res.status(400).json({
        success: false,
        message: "URL and strategy (mobile/desktop) are required",
      });
    }

    // Validate strategy
    if (!["mobile", "desktop"].includes(strategy)) {
      return res.status(400).json({
        success: false,
        message: "Strategy must be 'mobile' or 'desktop'",
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format",
      });
    }

    if (!GOOGLE_API_KEY) {
      console.error("❌ Google API key not configured");
      return res.status(500).json({
        success: false,
        message:
          "Google PageSpeed API not configured. Please check your API key.",
      });
    }

    // Retry logic
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `📊 Fetching PageSpeed data (${strategy}) - Attempt ${attempt}/${maxRetries}`
        );

        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
          url
        )}&strategy=${strategy}&key=${GOOGLE_API_KEY}`;

        const response = await axios.get(apiUrl, {
          timeout: 60000, // Increased from 30s to 60s
          validateStatus: (status) => status < 500,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        // Check for quota exceeded or API errors
        if (response.status === 403) {
          console.error("❌ API Error 403:", response.data);
          return res.status(403).json({
            success: false,
            message:
              "API quota exceeded or access denied. Check your API key permissions.",
            details: response.data.error?.message,
          });
        }

        if (response.status === 400) {
          console.error("❌ Bad Request 400:", response.data);
          return res.status(400).json({
            success: false,
            message: "Invalid request to PageSpeed API",
            details: response.data.error?.message,
          });
        }

        if (response.status >= 400) {
          console.error(`❌ API Error ${response.status}:`, response.data);
          throw new Error(
            response.data.error?.message ||
              `API returned status ${response.status}`
          );
        }

        // Success
        console.log(`✅ PageSpeed data fetched successfully for ${strategy}`);
        return res.status(200).json({
          success: true,
          data: response.data,
          strategy,
          url,
        });
      } catch (error) {
        lastError = error;
        console.warn(
          `⚠️  Attempt ${attempt}/${maxRetries} failed:`,
          error.message
        );

        // Don't retry on auth errors
        if (error.message.includes("403") || error.message.includes("401")) {
          console.error("❌ Authentication error - not retrying");
          return res.status(500).json({
            success: false,
            message: "Google API authentication failed. Verify your API key.",
            error: error.message,
          });
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    console.error("❌ All retry attempts failed");
    return res.status(503).json({
      success: false,
      message:
        "Failed to fetch PageSpeed data after multiple retries. The API may be experiencing issues.",
      error:
        process.env.NODE_ENV === "development"
          ? lastError?.message
          : "Service temporarily unavailable",
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ✅ WhatsApp send endpoint (uses controller)
router.post("/send-whatsapp-report", sendWhatsAppReport);

// ✅ Get audit status endpoint
router.get("/audit-status", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Audit service is active",
    limits: {
      maxAuditsPerDay: 3,
      maxPhoneNumbersPerRequest: 3,
    },
  });
});

export default router;
