#!/usr/bin/env node

/**
 * Direct SMS Injection Test
 * Injects SMS directly into the visible browser instance
 * So we can SEE the messages and responses in screenshots
 */

const puppeteer = require("puppeteer");
const path = require("path");

async function testDirectSMSInjection() {
  console.log("💬 Direct SMS Injection Test\n");
  console.log(
    "This will inject SMS directly into the ChatKit UI you can see\n"
  );
  console.log("═══════════════════════════════════════════════════════════\n");

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const testMessage = "Hello! Can you tell me a joke about programming?";

  let browser;

  try {
    // Launch VISIBLE browser
    console.log("🚀 Launching VISIBLE browser...\n");
    browser = await puppeteer.launch({
      headless: false,
      devtools: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1920,1080"
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Track all important logs
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("ChatKit") ||
        text.includes("SMS") ||
        text.includes("Response") ||
        text.includes("Message")
      ) {
        console.log(`  [Browser] ${text}`);
      }
    });

    // Load page
    console.log("🌐 Loading ChatKit...\n");
    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Wait for ChatKit to be ready
    console.log("⏳ Waiting for ChatKit to initialize...\n");
    await page.waitForFunction(
      () => {
        return window.__chatkitReady === true;
      },
      { timeout: 45000 }
    );

    console.log("✅ ChatKit is ready!\n");

    // Take screenshot of initial state
    const screenshot1 = path.join(__dirname, "sms-direct-1-initial.png");
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`📸 1. Initial state: ${screenshot1}\n`);

    console.log("═══════════════════════════════════════════════════════════");
    console.log("⏱️  WATCH THE BROWSER WINDOW NOW");
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );

    // Wait 3 seconds so you can see the initial state
    console.log("⏳ Waiting 3 seconds (observe the initial state)...\n");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Now inject the message DIRECTLY into this browser
    console.log("📤 INJECTING MESSAGE INTO CHATKIT UI...\n");
    console.log(`   Message: "${testMessage}"\n`);

    // Set up response listener BEFORE sending message
    const responsePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: "Timeout waiting for response" });
        }, 60000);

        window.addEventListener("chatkit:message", (event) => {
          const detail = event.detail;
          if (detail?.role === "assistant" && detail?.content) {
            clearTimeout(timeout);
            resolve({
              success: true,
              response: detail.content,
              timestamp: Date.now()
            });
          }
        });
      });
    });

    // Inject the message
    await page.evaluate((msg) => {
      console.log(
        "[INJECTION] Dispatching incoming-sms event with message:",
        msg
      );
      window.dispatchEvent(
        new CustomEvent("incoming-sms", {
          detail: {
            from: "+15551234567",
            message: msg
          }
        })
      );
      console.log("[INJECTION] Event dispatched!");
    }, testMessage);

    console.log("✅ Message injected! Watch the browser window...\n");

    // Wait a moment for the message to appear in UI
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take screenshot showing the user message
    const screenshot2 = path.join(__dirname, "sms-direct-2-message-sent.png");
    await page.screenshot({ path: screenshot2, fullPage: true });
    console.log(`📸 2. After message sent: ${screenshot2}\n`);

    // Monitor and wait for AI response
    console.log("⏳ Waiting for AI response...\n");

    let secondsPassed = 0;
    const startTime = Date.now();

    // Take progress screenshots while waiting
    const progressInterval = setInterval(async () => {
      secondsPassed = Math.floor((Date.now() - startTime) / 1000);
      if (secondsPassed % 5 === 0) {
        console.log(`  [${secondsPassed}s] Still processing...`);

        if (secondsPassed === 10 || secondsPassed === 20) {
          const progressScreenshot = path.join(
            __dirname,
            `sms-direct-3-progress-${secondsPassed}s.png`
          );
          await page.screenshot({ path: progressScreenshot, fullPage: true });
          console.log(`  📸 Progress: ${progressScreenshot}`);
        }
      }
    }, 1000);

    // Wait for response
    const result = await responsePromise;
    clearInterval(progressInterval);

    console.log(
      "\n═══════════════════════════════════════════════════════════"
    );

    if (result.success) {
      console.log("✅ AI RESPONSE RECEIVED!\n");
      console.log("Response:");
      console.log("─".repeat(60));
      console.log(result.response);
      console.log("─".repeat(60));
      console.log("");
    } else {
      console.log("⚠️  No response captured within timeout\n");
    }

    // Wait a bit more to ensure UI is fully updated
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take final screenshot showing the complete conversation
    const screenshot4 = path.join(
      __dirname,
      "sms-direct-4-final-conversation.png"
    );
    await page.screenshot({ path: screenshot4, fullPage: true });
    console.log(`📸 4. Final conversation: ${screenshot4}\n`);

    // Get final state from DOM
    const finalState = await page.evaluate(() => {
      const bodyText = document.body?.textContent || "";

      // Try to extract visible messages
      const visibleContent = bodyText.substring(0, 1000).replace(/\s+/g, " ");

      return {
        bodyPreview: visibleContent.substring(0, 300),
        hasUserMessage:
          visibleContent.includes("joke") ||
          visibleContent.includes("programming"),
        hasResponse: window.__chatkitLastResponse?.length > 0,
        responseLength: window.__chatkitLastResponse?.length || 0
      };
    });

    console.log("📊 Final State:");
    console.log(`  User message visible: ${finalState.hasUserMessage}`);
    console.log(`  Response captured: ${finalState.hasResponse}`);
    console.log(`  Response length: ${finalState.responseLength} chars`);
    console.log(
      `  Body preview: "${finalState.bodyPreview.substring(0, 150)}..."\n`
    );

    console.log("═══════════════════════════════════════════════════════════");
    console.log("📸 SCREENSHOTS GENERATED:");
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );
    console.log(
      "  1. sms-direct-1-initial.png         - Initial ChatKit state"
    );
    console.log("  2. sms-direct-2-message-sent.png    - After user message");
    console.log("  3. sms-direct-3-progress-*.png      - During processing");
    console.log(
      "  4. sms-direct-4-final-conversation.png - Complete conversation\n"
    );

    console.log("═══════════════════════════════════════════════════════════");
    console.log(
      result.success ? "✅ TEST PASSED!" : "⚠️  TEST COMPLETED (partial)"
    );
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );

    // Keep browser open for 30 seconds so you can see the result
    console.log("🔍 Browser will stay open for 30 seconds for inspection...\n");
    console.log(
      "   Look at the browser window to see the full conversation!\n"
    );
    await new Promise((resolve) => setTimeout(resolve, 30000));
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);

    // Keep browser open on error
    console.log(
      "\n⚠️  Error occurred. Browser will stay open for 60 seconds...\n"
    );
    await new Promise((resolve) => setTimeout(resolve, 60000));

    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Browser closed");
    }
  }
}

testDirectSMSInjection().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
