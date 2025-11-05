#!/usr/bin/env node

/**
 * Test ChatKit interaction - send a message and capture response
 */

const puppeteer = require("puppeteer");
const path = require("path");

async function testChatKitInteraction() {
  console.log("💬 Testing ChatKit Message Interaction\n");

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== "false",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Collect all console logs
    const consoleMessages = [];
    page.on("console", (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (
        text.includes("ChatKit") ||
        text.includes("SMS") ||
        text.includes("Response")
      ) {
        console.log(`  [Browser ${msg.type()}] ${text}`);
      }
    });

    console.log("🌐 Loading AgentKit application...");
    await page.goto(appUrl, { waitUntil: "networkidle0", timeout: 30000 });
    console.log("✓ Page loaded\n");

    // Wait for ChatKit to be ready
    console.log("⏳ Waiting for ChatKit to initialize...");
    await page.waitForFunction(
      () => {
        return window.__chatkitReady === true;
      },
      { timeout: 15000 }
    );
    console.log("✓ ChatKit is ready!\n");

    // Take screenshot before interaction
    const beforeScreenshot = path.join(__dirname, "chatkit-before-message.png");
    await page.screenshot({ path: beforeScreenshot, fullPage: true });
    console.log(`📸 Before: ${beforeScreenshot}\n`);

    // Check the current state
    const initialState = await page.evaluate(() => {
      const bodyText = document.body?.textContent || "";
      return {
        bodyPreview: bodyText.substring(0, 200),
        hasLoading: bodyText.includes("Loading"),
        chatkitReady: window.__chatkitReady
      };
    });

    console.log("📊 Initial State:");
    console.log(`  ChatKit Ready: ${initialState.chatkitReady}`);
    console.log(`  Has Loading Text: ${initialState.hasLoading}`);
    console.log(
      `  Body Preview: "${initialState.bodyPreview.substring(0, 100)}..."\n`
    );

    // Try to inject a test message using the incoming-sms event
    console.log("📤 Sending test message via incoming-sms event...");

    const messageResult = await page.evaluate(() => {
      console.log("[TEST] Dispatching incoming-sms event...");

      // Dispatch the SMS event
      window.dispatchEvent(
        new CustomEvent("incoming-sms", {
          detail: {
            from: "+15551234567",
            message: "Hello! This is a test message from Puppeteer."
          }
        })
      );

      return { dispatched: true };
    });

    console.log(`✓ Message event dispatched: ${messageResult.dispatched}\n`);

    // Wait a bit for the message to be processed
    console.log("⏳ Waiting for response (30 seconds max)...");

    // Wait for either a response or timeout
    try {
      await page.waitForFunction(
        () => {
          return window.__chatkitResponseComplete === true;
        },
        { timeout: 30000 }
      );
      console.log("✓ Response received!\n");
    } catch (timeoutError) {
      console.log(
        "⚠️  No response within 30 seconds (this might be expected)\n"
      );
    }

    // Check if we got a response
    const responseData = await page.evaluate(() => {
      return {
        hasResponse: window.__chatkitResponseComplete === true,
        responseText: window.__chatkitLastResponse || null,
        responseTimestamp: window.__chatkitResponseTimestamp || null
      };
    });

    console.log("📥 Response Data:");
    console.log(`  Has Response: ${responseData.hasResponse}`);
    if (responseData.responseText) {
      console.log(
        `  Response Length: ${responseData.responseText.length} characters`
      );
      console.log(
        `  Response Preview: "${responseData.responseText.substring(0, 200)}..."`
      );
      console.log(
        `  Timestamp: ${responseData.responseTimestamp ? new Date(responseData.responseTimestamp).toISOString() : "N/A"}`
      );
    } else {
      console.log(`  No response captured yet`);
    }
    console.log("");

    // Take screenshots after interaction
    console.log("📸 Capturing post-interaction screenshots...\n");

    const afterScreenshot = path.join(__dirname, "chatkit-after-message.png");
    await page.screenshot({ path: afterScreenshot, fullPage: true });
    console.log(`  ✓ After message: ${afterScreenshot}`);

    // Wait 5 more seconds to see if UI updates
    console.log("\n⏳ Waiting 5 more seconds for UI updates...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const finalScreenshot = path.join(__dirname, "chatkit-final-state.png");
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`  ✓ Final state: ${finalScreenshot}\n`);

    // Check final DOM state
    const finalState = await page.evaluate(() => {
      const bodyText = document.body?.textContent || "";

      // Try to find message elements
      const allText = [];
      document.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) {
          const shadowText = el.shadowRoot.textContent;
          if (shadowText && shadowText.trim().length > 10) {
            allText.push(shadowText.trim().substring(0, 100));
          }
        }
      });

      return {
        bodyText: bodyText.substring(0, 500),
        hasLoading: bodyText.includes("Loading"),
        shadowTexts: allText,
        messageElements: document.querySelectorAll(
          '[data-message], [class*="message"]'
        ).length
      };
    });

    console.log("📊 Final DOM State:");
    console.log(`  Still Loading: ${finalState.hasLoading}`);
    console.log(`  Message Elements: ${finalState.messageElements}`);
    console.log(`  Body Text: "${finalState.bodyText.substring(0, 150)}..."`);
    if (finalState.shadowTexts.length > 0) {
      console.log(`  Shadow DOM texts found: ${finalState.shadowTexts.length}`);
      finalState.shadowTexts.forEach((text, i) => {
        console.log(`    ${i + 1}. ${text.substring(0, 80)}...`);
      });
    }
    console.log("");

    // Summary
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📊 INTERACTION TEST SUMMARY");
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );
    console.log(`✅ ChatKit initialized: YES`);
    console.log(`✅ Message sent: YES`);
    console.log(
      `${responseData.hasResponse ? "✅" : "❌"} Response received: ${responseData.hasResponse ? "YES" : "NO"}`
    );
    console.log(`📸 Screenshots captured: 3\n`);

    if (responseData.responseText) {
      console.log("Response Content:");
      console.log("─".repeat(60));
      console.log(responseData.responseText);
      console.log("─".repeat(60));
    }

    console.log("\n✅ Test complete!\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Browser closed");
    }
  }
}

testChatKitInteraction().catch(console.error);
