// Webhook endpoint for incoming SMS from Twilio
// Uses headless Chromium to run ChatKit UI server-side
import twilio from "twilio";
import puppeteer, { Browser, Page } from "puppeteer";
import tesseract from "node-tesseract-ocr";

export const runtime = "nodejs";

// Clean response text by removing unwanted patterns
function cleanResponse(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // CRITICAL: Remove JavaScript code patterns
  // This removes tracking scripts, function declarations, etc.

  // Remove entire JavaScript blocks that start with (function() or function(
  cleaned = cleaned.replace(/\(function\(\)\{[\s\S]*?\}\)/g, "");
  cleaned = cleaned.replace(/function\s*\([^)]*\)\s*\{[\s\S]*?\}/g, "");

  // Remove variable declarations with complex objects
  cleaned = cleaned.replace(/var\s+\w+\s*=\s*\{[\s\S]*?\};?/g, "");
  cleaned = cleaned.replace(/var\s+\w+\s*=[\s\S]*?;/g, "");

  // Remove script URLs and CDN references
  cleaned = cleaned.replace(/https?:\/\/[^\s'"]+/g, "");
  cleaned = cleaned.replace(/\/cdn-cgi\/[^\s'"]+/g, "");

  // Remove DOM manipulation code
  cleaned = cleaned.replace(/document\.[a-zA-Z]+\([^)]*\)/g, "");
  cleaned = cleaned.replace(/\.createElement\([^)]*\)/g, "");
  cleaned = cleaned.replace(/\.appendChild\([^)]*\)/g, "");
  cleaned = cleaned.replace(/\.getElementsByTagName\([^)]*\)/g, "");

  // Remove script tag references
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Remove JavaScript-style comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  cleaned = cleaned.replace(/\/\/.*$/gm, "");

  // Remove object notation and JSON-like structures
  cleaned = cleaned.replace(/\{[^{}]*:[^{}]*\}/g, "");

  // Remove any remaining code-like patterns
  cleaned = cleaned.replace(
    /\b(if|var|function|return|document|window)\s*\(/g,
    "",
  );

  // Remove common UI noise patterns (case-insensitive)
  const noisePatterns = [
    /\bSend\b/gi,
    /\bCopy\b/gi,
    /\bCopied!\b/gi,
    /\bShare\b/gi,
    /\bRetry\b/gi,
    /\bStop generating\b/gi,
    /\bRegenerate\b/gi,
  ];

  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Remove excess whitespace and special characters
  cleaned = cleaned.replace(/[{}\[\]();]/g, " "); // Replace code punctuation with spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

// Rate limiting: Track SMS requests per phone number
interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 SMS per hour per phone number

function checkRateLimit(phoneNumber: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(phoneNumber);

  if (!entry) {
    // First request from this number
    rateLimitStore.set(phoneNumber, { count: 1, firstRequest: now });
    return { allowed: true };
  }

  // Check if the window has expired
  if (now - entry.firstRequest > RATE_LIMIT_WINDOW) {
    // Reset the counter
    rateLimitStore.set(phoneNumber, { count: 1, firstRequest: now });
    return { allowed: true };
  }

  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil(
      (entry.firstRequest + RATE_LIMIT_WINDOW - now) / 1000,
    );
    return { allowed: false, retryAfter };
  }

  // Increment counter
  entry.count++;
  return { allowed: true };
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [phoneNumber, entry] of rateLimitStore.entries()) {
    if (now - entry.firstRequest > RATE_LIMIT_WINDOW) {
      rateLimitStore.delete(phoneNumber);
    }
  }
}, 300000); // Clean up every 5 minutes

// Initialize Twilio client with API Key authentication
let twilioClient: twilio.Twilio | null = null;
function getTwilioClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      throw new Error(
        "Missing Twilio credentials. Required: TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET",
      );
    }

    // Use API Key authentication (more secure than Auth Token)
    twilioClient = twilio(apiKeySid, apiKeySecret, { accountSid });
  }
  return twilioClient;
}

// Browser instance pool (one per phone number for conversation continuity)
interface BrowserSession {
  browser: Browser;
  page: Page;
  sessionStarted: number;
  lastActivity: number;
  getCapturedSSEResponse: () => string | null;
  clearCapturedSSEResponse: () => void;
}

const browserSessions = new Map<string, BrowserSession>();

async function getOrCreateBrowserSession(
  phoneNumber: string,
): Promise<BrowserSession> {
  let session = browserSessions.get(phoneNumber);

  // Reuse existing session if it's less than 30 minutes old
  if (session && Date.now() - session.sessionStarted < 1800000) {
    console.log("[browserless] Reusing existing session for:", phoneNumber);
    session.lastActivity = Date.now();
    return session;
  }

  // Clean up old session if it exists
  if (session) {
    console.log("[browserless] Closing old session for:", phoneNumber);
    try {
      await session.browser.close();
    } catch (e) {
      console.error("[browserless] Error closing old browser:", e);
    }
  }

  console.log("[browserless] Creating new browser for:", phoneNumber);

  // Determine if we should use headless mode
  // Use headless: true by default for reliability (SSE interception works in both modes)
  // Set PUPPETEER_HEADLESS=false explicitly if you want to view the browser
  const isHeadless = process.env.PUPPETEER_HEADLESS !== "false";

  console.log("[browserless] Headless mode:", isHeadless);

  const browser = await puppeteer.launch({
    headless: isHeadless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-site-isolation-trials",
      "--allow-running-insecure-content",
      "--disable-blink-features=AutomationControlled",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  });

  const page = await browser.newPage();

  // Enable request interception for SSE stream capture
  await page.setRequestInterception(true);

  // Store captured SSE response
  let capturedSSEResponse: string | null = null;

  page.on("request", (request) => {
    // Always continue all requests
    request.continue();
  });

  // MAIN CAPTURE METHOD: Intercept ChatKit conversation SSE responses
  page.on("response", async (response) => {
    const url = response.url();

    // Capture ChatKit conversation SSE stream
    if (
      url.includes("api.openai.com") &&
      url.includes("chatkit/conversation") &&
      response.status() === 200
    ) {
      try {
        const text = await response.text();

        // Only process substantial responses (skip preflight/small responses)
        if (text.length > 100) {
          console.log(
            "[sse-intercept] 📡 Captured conversation response:",
            text.length,
            "bytes",
          );

          // Parse SSE format and extract assistant response
          const lines = text.split("\n");
          let assistantText = "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.substring(6).trim();
              if (!dataStr || dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);

                // Extract from item.content[] (ChatKit SSE format)
                if (
                  parsed.item?.content &&
                  Array.isArray(parsed.item.content)
                ) {
                  const text = parsed.item.content
                    .filter((c: any) => c.type === "output_text")
                    .map((c: any) => c.text)
                    .join("");

                  if (text && text.length > 0) {
                    assistantText = text; // Keep updating with latest
                  }
                }

                // Extract from message.content[] (alternative format)
                if (
                  parsed.message?.content &&
                  Array.isArray(parsed.message.content)
                ) {
                  const text = parsed.message.content
                    .filter((c: any) => c.type === "output_text")
                    .map((c: any) => c.text)
                    .join("");

                  if (text && text.length > 0) {
                    assistantText = text;
                  }
                }
              } catch (e) {
                // Not JSON, skip
              }
            }
          }

          if (assistantText) {
            capturedSSEResponse = assistantText;
            console.log(
              "[sse-intercept] ✅ Extracted assistant response:",
              assistantText.substring(0, 100),
            );
            console.log(
              "[sse-intercept] Response length:",
              assistantText.length,
              "chars",
            );
          }
        }
      } catch (error) {
        // Could not read body (e.g., preflight request)
      }
    }
  });

  // Set realistic user agent to avoid detection
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  );

  // Set additional headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    Origin: "http://localhost:3001",
  });

  // Enable console logging from the browser
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === "error") {
      console.error("[browser-console]", text);
    } else if (text.includes("ChatKit") || text.includes("SMS")) {
      console.log("[browser-console]", text);
    }
  });

  // Capture page errors
  page.on("pageerror", (error) => {
    console.error("[browser-error]", error.message);
  });

  // Navigate to our ChatKit UI page
  // In Cloud Run/Docker, use PORT env var; locally use 3000
  const port = process.env.PORT || "3000";
  const appUrl = process.env.APP_URL || `http://localhost:${port}`;
  console.log("[browserless] Loading ChatKit UI from:", appUrl);

  await page.goto(appUrl, {
    waitUntil: "networkidle0",
    timeout: 60000,
  });

  console.log(
    "[browserless] Page loaded, waiting for ChatKitPanel to initialize...",
  );

  // Wait for ChatKitPanel's incoming-sms listener to be registered
  try {
    await page.waitForFunction(
      () => {
        return (window as any).__chatkitReady === true;
      },
      { timeout: 30000 },
    );
    console.log("[browserless] ✅ ChatKitPanel ready");
  } catch (e) {
    // Fallback: just wait a fixed time for React to hydrate
    console.log(
      "[browserless] Using fallback: waiting 8 seconds for React hydration...",
    );
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Check if listener is ready
    const isReady = await page.evaluate(
      () => (window as any).__chatkitReady === true,
    );
    if (isReady) {
      console.log("[browserless] ✅ ChatKitPanel ready (after fallback)");
    } else {
      console.log(
        "[browserless] ⚠️  ChatKitPanel may not be ready, proceeding anyway...",
      );
    }
  }

  session = {
    browser,
    page,
    sessionStarted: Date.now(),
    lastActivity: Date.now(),
    getCapturedSSEResponse: () => capturedSSEResponse,
    clearCapturedSSEResponse: () => {
      capturedSSEResponse = null;
    },
  };

  browserSessions.set(phoneNumber, session);
  console.log("[browserless] ✅ Browser session ready for:", phoneNumber);

  return session;
}

// OCR-based response extraction from screenshot (ULTIMATE FALLBACK)
async function extractResponseViaOCR(
  screenshotPath: string,
): Promise<string | null> {
  try {
    console.log("[ocr-fallback] Attempting OCR extraction from screenshot...");

    const ocrConfig = {
      lang: "eng",
      oem: 1, // LSTM OCR Engine Mode
      psm: 6, // Assume a single uniform block of text
    };

    const text = await tesseract.recognize(screenshotPath, ocrConfig);

    if (!text || text.trim().length === 0) {
      console.log("[ocr-fallback] ⚠️  No text extracted from screenshot");
      return null;
    }

    console.log("[ocr-fallback] ✅ OCR extracted", text.length, "characters");
    console.log("[ocr-fallback] Raw OCR text:", text.substring(0, 200));

    // Try to extract the assistant's response from the OCR text
    // ChatKit typically shows messages in order, with the latest at bottom
    // Look for patterns that indicate an assistant response

    const lines = text.split("\n").filter((line) => line.trim().length > 0);

    // Filter out common UI elements and noise
    const filteredLines = lines.filter((line) => {
      const lower = line.toLowerCase();
      const trimmed = line.trim();

      // Filter out UI elements, placeholders, and OCR noise
      return (
        !lower.includes("how can i help") &&
        !lower.includes("send message") &&
        !lower.includes("sms conversation") &&
        !lower.includes("ask anything") &&
        !lower.includes("workflow") &&
        !lower.includes("update") &&
        !lower.match(/^\+?\d+$/) && // Skip phone numbers
        !lower.match(/^wf_[a-z0-9]+/) && // Skip workflow IDs
        !trimmed.match(/^[eox\+\[\]\s]{1,10}$/i) && // Skip short symbol-only strings like "eo + x"
        trimmed.length > 5
      ); // Skip very short strings
    });

    // The assistant's response is usually the longest continuous text block
    // that doesn't match the user's input message
    if (filteredLines.length > 0) {
      // Take the last substantial block of text as the response
      const response = filteredLines.slice(-3).join(" ").trim();
      console.log(
        "[ocr-fallback] ✅ Extracted response:",
        response.substring(0, 100),
      );
      return response;
    }

    return null;
  } catch (error) {
    console.error("[ocr-fallback] ❌ OCR extraction failed:", error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    // Parse incoming SMS from Twilio
    const formData = await request.formData();
    const from = formData.get("From") as string;
    const message = formData.get("Body") as string;

    // Security: Rate limiting
    const rateLimit = checkRateLimit(from);
    if (!rateLimit.allowed) {
      console.warn("[sms-webhook] ⚠️  Rate limit exceeded for:", from);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Rate limit exceeded. Please try again in ${rateLimit.retryAfter} seconds.</Message></Response>`,
        {
          status: 429,
          headers: {
            "Content-Type": "text/xml",
            "Retry-After": String(rateLimit.retryAfter),
          },
        },
      );
    }

    // Security: Input validation
    if (!from || !message) {
      console.error("[sms-webhook] ❌ Missing required fields");
      return new Response("Bad Request: Missing From or Body", { status: 400 });
    }

    // Limit message length (SMS is max 1600 chars for concatenated messages)
    if (message.length > 1600) {
      console.warn("[sms-webhook] ⚠️  Message too long:", message.length);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Message too long. Please keep under 1600 characters.</Message></Response>',
        {
          status: 400,
          headers: { "Content-Type": "text/xml" },
        },
      );
    }

    console.log("[sms-webhook] ========================================");
    console.log("[sms-webhook] Received SMS from:", from);
    console.log("[sms-webhook] Message:", message.substring(0, 100));
    console.log("[sms-webhook] ========================================");

    // Get or create browser session for this phone number
    const session = await getOrCreateBrowserSession(from);
    const { page } = session;

    console.log("[sms-webhook] Injecting message into ChatKit...");

    // Clear any previous SSE response
    session.clearCapturedSSEResponse();

    // Inject the SMS message into the page
    await page.evaluate(
      (msg, phone) => {
        console.log("[browserless-eval] Dispatching incoming-sms event...");
        window.dispatchEvent(
          new CustomEvent("incoming-sms", {
            detail: { from: phone, message: msg },
          }),
        );
        console.log("[browserless-eval] Event dispatched");
      },
      message,
      from,
    );

    console.log("[sms-webhook] Waiting for SSE response (max 30 seconds)...");

    // Poll for SSE-captured response
    let response: string | null = null;
    let captureMethod = "sse-intercept";
    const maxWaitTime = 30000; // 30 seconds
    const pollInterval = 500; // Check every 500ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const captured = session.getCapturedSSEResponse();

      if (captured && captured.length > 0) {
        response = captured;
        console.log(
          "[sms-webhook] ✅ SSE Response captured:",
          response.substring(0, 200),
        );
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // FALLBACK: If SSE didn't capture, try OCR (if not disabled)
    if (!response) {
      const ocrDisabled = process.env.DISABLE_OCR_FALLBACK === "true";

      if (ocrDisabled) {
        console.log(
          "[sms-webhook] ⚠️  SSE capture timed out and OCR is disabled",
        );
        throw new Error(
          "SSE capture failed and OCR fallback is disabled. Check ChatKit configuration and SSE interception.",
        );
      }

      console.log(
        "[sms-webhook] ⚠️  SSE capture timed out, attempting OCR fallback...",
      );

      // Wait a bit more for response to render
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const screenshotPath = `/tmp/sms-${from.replace(/\+/g, "")}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log("[sms-webhook] 📸 Screenshot saved for OCR:", screenshotPath);

      const ocrResponse = await extractResponseViaOCR(screenshotPath);

      if (ocrResponse && ocrResponse.length > 10) {
        response = ocrResponse;
        captureMethod = "ocr-fallback";
        console.log(
          "[sms-webhook] ✅ ChatKit Response received (OCR):",
          response.substring(0, 200),
        );
      } else {
        throw new Error("Both SSE and OCR capture failed");
      }
    }

    console.log("[sms-webhook] 📊 Capture method used:", captureMethod);

    // Clean the response to remove UI noise
    response = cleanResponse(response);
    console.log(
      "[sms-webhook] 🧹 Cleaned response length:",
      response.length,
      "chars",
    );

    // Take a screenshot for debugging (only if we haven't taken one for OCR)
    if (captureMethod !== "ocr") {
      try {
        const screenshotPath = `/tmp/sms-${from.replace(/\+/g, "")}-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log("[sms-webhook] 📸 Screenshot saved:", screenshotPath);
      } catch (e) {
        console.error("[sms-webhook] Failed to save screenshot:", e);
      }
    }

    // Send SMS response via Twilio
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    const hasRealTwilioCredentials =
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_ACCOUNT_SID !== "your_account_sid_here" &&
      process.env.TWILIO_API_KEY_SID &&
      process.env.TWILIO_API_KEY_SID !== "your_api_key_sid_here" &&
      process.env.TWILIO_API_KEY_SECRET &&
      process.env.TWILIO_API_KEY_SECRET !== "your_api_key_secret_here";

    if (hasRealTwilioCredentials) {
      const twilioClientInstance = getTwilioClient();
      await twilioClientInstance.messages.create({
        body: response,
        from: twilioPhoneNumber,
        to: from,
      });
      console.log("[sms-webhook] ✅ SMS sent successfully to:", from);
    } else {
      console.log("[sms-webhook] 📝 DEMO MODE - Would send SMS:");
      console.log("[sms-webhook]    From:", twilioPhoneNumber);
      console.log("[sms-webhook]    To:", from);
      console.log("[sms-webhook]    Message:", response);
      console.log(
        "[sms-webhook] ⚠️  Set real Twilio credentials to send actual SMS",
      );
    }

    // Respond to Twilio webhook (TwiML response)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      },
    );
  } catch (error) {
    console.error("[sms-webhook] ❌ Error:", error);
    return new Response("Error processing SMS", { status: 500 });
  }
}

// Cleanup old browser sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [phoneNumber, session] of browserSessions.entries()) {
    if (now - session.lastActivity > 1800000) {
      // 30 minutes
      console.log("[browserless] Cleaning up idle session for:", phoneNumber);
      session.browser.close().catch(() => {});
      browserSessions.delete(phoneNumber);
    }
  }
}, 300000); // Run every 5 minutes

// Health check endpoint
export async function GET() {
  const activeSessions = browserSessions.size;
  return Response.json({
    mode: "browserless-chatkit",
    activeSessions,
    sessions: Array.from(browserSessions.keys()),
  });
}

// Cleanup endpoint (for testing)
export async function DELETE() {
  console.log("[browserless] Cleaning up all browser sessions...");
  for (const [phoneNumber, session] of browserSessions.entries()) {
    try {
      await session.browser.close();
    } catch (e) {
      console.error("[browserless] Error closing browser:", e);
    }
  }
  browserSessions.clear();
  return Response.json({ success: true, message: "All sessions closed" });
}
