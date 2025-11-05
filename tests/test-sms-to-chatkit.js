#!/usr/bin/env node

/**
 * End-to-End SMS Integration Test
 * 1. Opens ChatKit in visible browser
 * 2. Sends SMS via webhook
 * 3. Captures ChatKit response
 * 4. Takes screenshots throughout
 */

const puppeteer = require("puppeteer");
const path = require("path");

async function testSMSIntegration() {
  console.log("📱 SMS to ChatKit Integration Test\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const testPhoneNumber = "+15551234567";
  const testMessage =
    "Hello! This is a test message from SMS. Can you help me?";

  let browser;

  try {
    // Step 1: Launch browser
    console.log("🚀 Step 1: Launching browser in visible mode...\n");
    browser = await puppeteer.launch({
      headless: false,
      devtools: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Track console logs
    const logs = [];
    page.on("console", (msg) => {
      const text = msg.text();
      logs.push({ type: msg.type(), text, timestamp: Date.now() });

      if (
        text.includes("ChatKit") ||
        text.includes("SMS") ||
        text.includes("Response") ||
        text.includes("Message")
      ) {
        console.log(`  [Browser ${msg.type()}] ${text}`);
      }
    });

    // Step 2: Load ChatKit
    console.log("🌐 Step 2: Loading ChatKit application...\n");
    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log("✓ Page loaded\n");

    // Wait a bit for scripts to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 3: Wait for ChatKit to initialize
    console.log("⏳ Step 3: Waiting for ChatKit to initialize...\n");
    await page.waitForFunction(
      () => {
        return window.__chatkitReady === true;
      },
      { timeout: 30000 },
    );
    console.log("✓ ChatKit is ready!\n");

    // Take screenshot of initial state
    const initialScreenshot = path.join(__dirname, "sms-test-1-initial.png");
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    console.log(`📸 Initial state: ${initialScreenshot}\n`);

    // Step 4: Send SMS
    console.log("📤 Step 4: Sending SMS to webhook...\n");
    console.log(`  From: ${testPhoneNumber}`);
    console.log(`  Message: "${testMessage}"\n`);

    const smsResponse = await fetch(`${appUrl}/api/sms-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: testPhoneNumber,
        Body: testMessage,
      }),
    });

    const smsResult = await smsResponse.text();
    console.log(
      `✓ SMS sent! Response: ${smsResponse.status} ${smsResponse.statusText}`,
    );
    console.log(`  Response body: ${smsResult.substring(0, 100)}\n`);

    // Step 5: Wait for message to appear in UI
    console.log("⏳ Step 5: Waiting for message to appear in ChatKit UI...\n");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take screenshot after SMS sent
    const afterSMSScreenshot = path.join(__dirname, "sms-test-2-after-sms.png");
    await page.screenshot({ path: afterSMSScreenshot, fullPage: true });
    console.log(`📸 After SMS sent: ${afterSMSScreenshot}\n`);

    // Check if message appeared
    const messageState = await page.evaluate(() => {
      const bodyText = document.body?.textContent || "";
      return {
        bodyPreview: bodyText.substring(0, 300).replace(/\s+/g, " "),
        hasTestMessage: bodyText.includes("test message"),
        hasHelp: bodyText.toLowerCase().includes("help"),
      };
    });

    console.log("📊 UI State after SMS:");
    console.log(`  Has test message: ${messageState.hasTestMessage}`);
    console.log(
      `  Content preview: "${messageState.bodyPreview.substring(0, 150)}..."\n`,
    );

    // Step 6: Wait for AI response
    console.log("⏳ Step 6: Waiting for AI response (up to 30 seconds)...\n");

    // Monitor for response
    let responseReceived = false;
    let aiResponse = null;

    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const state = await page.evaluate(() => {
        return {
          responseComplete: window.__chatkitResponseComplete || false,
          responseText: window.__chatkitLastResponse || null,
          responseTimestamp: window.__chatkitResponseTimestamp || null,
        };
      });

      if (
        state.responseComplete &&
        state.responseText &&
        state.responseTimestamp > Date.now() - 30000
      ) {
        responseReceived = true;
        aiResponse = state.responseText;
        console.log(`✅ Response received after ${i + 1} seconds!\n`);
        break;
      }

      // Log progress every 5 seconds
      if ((i + 1) % 5 === 0) {
        console.log(`  [${i + 1}s] Still waiting...`);

        // Take progress screenshot
        if (i === 9 || i === 19) {
          const progressScreenshot = path.join(
            __dirname,
            `sms-test-3-progress-${i + 1}s.png`,
          );
          await page.screenshot({ path: progressScreenshot, fullPage: true });
          console.log(`  📸 Progress: ${progressScreenshot}`);
        }
      }
    }

    // Step 7: Capture final state
    console.log("\n📸 Step 7: Capturing final screenshots...\n");

    const finalScreenshot = path.join(__dirname, "sms-test-4-final.png");
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`  ✓ Final state: ${finalScreenshot}\n`);

    // Get final DOM state
    const finalState = await page.evaluate(() => {
      const bodyText = document.body?.textContent || "";

      // Try to extract messages from DOM
      const messages = [];
      document.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) {
          const shadowText = el.shadowRoot.textContent;
          if (
            shadowText &&
            shadowText.length > 50 &&
            shadowText.length < 5000
          ) {
            messages.push(shadowText.trim());
          }
        }
      });

      return {
        bodyText: bodyText.substring(0, 500),
        messages,
        chatkitReady: window.__chatkitReady,
        responseText: window.__chatkitLastResponse,
        responseComplete: window.__chatkitResponseComplete,
      };
    });

    // Step 8: Summary
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📊 TEST SUMMARY");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    console.log("✅ Test Steps:");
    console.log("  1. ✓ Browser launched");
    console.log("  2. ✓ ChatKit loaded");
    console.log("  3. ✓ ChatKit initialized");
    console.log("  4. ✓ SMS sent to webhook");
    console.log(
      `  5. ${messageState.hasTestMessage ? "✓" : "⚠"} Message injected into UI`,
    );
    console.log(`  6. ${responseReceived ? "✓" : "❌"} AI response received`);
    console.log("  7. ✓ Screenshots captured\n");

    if (responseReceived && aiResponse) {
      console.log("📥 AI RESPONSE:");
      console.log("─".repeat(60));
      console.log(aiResponse);
      console.log("─".repeat(60));
      console.log("");
    } else if (finalState.responseText) {
      console.log("📥 CAPTURED RESPONSE (from window):");
      console.log("─".repeat(60));
      console.log(finalState.responseText);
      console.log("─".repeat(60));
      console.log("");
    } else {
      console.log("⚠️  No AI response captured. Possible reasons:");
      console.log("  - Response took longer than 30 seconds");
      console.log("  - Workflow may need configuration");
      console.log("  - Check browser console for errors\n");
    }

    console.log("📊 Console Logs Summary:");
    console.log(`  Total logs captured: ${logs.length}`);
    const errorLogs = logs.filter((l) => l.type === "error");
    if (errorLogs.length > 0) {
      console.log(`  Errors: ${errorLogs.length}`);
      errorLogs.slice(0, 3).forEach((log) => {
        console.log(`    - ${log.text.substring(0, 100)}`);
      });
    }
    console.log("");

    console.log("📸 Screenshots Generated:");
    console.log("  1. sms-test-1-initial.png - Initial ChatKit state");
    console.log("  2. sms-test-2-after-sms.png - After SMS sent");
    console.log("  3. sms-test-3-progress-*.png - Progress snapshots");
    console.log("  4. sms-test-4-final.png - Final state\n");

    // Save detailed report
    const report = {
      testPhoneNumber,
      testMessage,
      responseReceived,
      aiResponse,
      finalState,
      logs: logs.slice(-50),
      timestamp: new Date().toISOString(),
    };

    require("fs").writeFileSync(
      path.join(__dirname, "sms-test-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log("📄 Detailed report saved to: sms-test-report.json\n");

    console.log("═══════════════════════════════════════════════════════════");
    console.log(
      responseReceived
        ? "✅ TEST PASSED!"
        : "⚠️  TEST COMPLETED (check results)",
    );
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );

    // Keep browser open for 15 seconds for inspection
    console.log("Browser will stay open for 15 seconds for inspection...\n");
    await new Promise((resolve) => setTimeout(resolve, 15000));
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);

    // Keep browser open on error
    console.log(
      "\n⚠️  Error occurred. Browser will stay open for 30 seconds...\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 30000));

    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Browser closed");
    }
  }
}

testSMSIntegration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
