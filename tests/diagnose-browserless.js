#!/usr/bin/env node

// Diagnostic script to test browserless ChatKit integration
const puppeteer = require("puppeteer");

async function diagnose() {
  console.log("🔍 Diagnosing browserless ChatKit setup...\n");

  let browser;
  try {
    // Step 1: Launch browser
    console.log("1. Launching headless Chromium...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-site-isolation-trials",
        "--allow-running-insecure-content",
      ],
      ignoreHTTPSErrors: true,
    });
    console.log("   ✅ Browser launched\n");

    // Step 2: Create page
    console.log("2. Creating new page...");
    const page = await browser.newPage();

    // Capture console logs
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      console.log(`   [browser ${type}]`, text);
    });

    // Capture errors
    page.on("pageerror", (error) => {
      console.error("   [browser error]", error.message);
    });

    console.log("   ✅ Page created\n");

    // Step 3: Navigate
    console.log("3. Loading http://localhost:3001...");
    await page.goto("http://localhost:3001", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log("   ✅ Page loaded\n");

    // Step 4: Wait for ChatKit
    console.log("4. Waiting for ChatKit web component...");
    try {
      await page.waitForFunction(
        () => window.customElements?.get("openai-chatkit") !== undefined,
        { timeout: 30000 }
      );
      console.log("   ✅ ChatKit web component registered\n");
    } catch (e) {
      console.error("   ❌ ChatKit web component NOT found\n");
      throw e;
    }

    // Step 5: Wait for React hydration
    console.log("5. Waiting for React hydration (3 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log("   ✅ Wait complete\n");

    // Step 6: Test incoming-sms event
    console.log("6. Testing incoming-sms event dispatch...");
    const testResult = await page.evaluate(async () => {
      return new Promise((resolve) => {
        let eventReceived = false;
        let messageReceived = false;

        // Listen for incoming-sms event being received
        const smsHandler = (event) => {
          console.log("[diagnose] incoming-sms event received:", event.detail);
          eventReceived = true;
        };

        // Listen for chatkit:message event
        const messageHandler = (event) => {
          console.log(
            "[diagnose] chatkit:message event received:",
            event.detail
          );
          messageReceived = true;
          resolve({
            eventReceived,
            messageReceived,
            response: event.detail?.content || "No content",
          });
        };

        window.addEventListener("incoming-sms", smsHandler);
        window.addEventListener("chatkit:message", messageHandler);

        // Dispatch test event
        window.dispatchEvent(
          new CustomEvent("incoming-sms", {
            detail: { from: "+15551234567", message: "Test message" },
          })
        );

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener("incoming-sms", smsHandler);
          window.removeEventListener("chatkit:message", messageHandler);
          resolve({
            eventReceived,
            messageReceived,
            response: "Timeout - no response received",
          });
        }, 30000);
      });
    });

    console.log("   Result:", JSON.stringify(testResult, null, 2));
    console.log("");

    if (testResult.messageReceived) {
      console.log("✅ SUCCESS! Browserless mode is working correctly\n");
    } else if (testResult.eventReceived) {
      console.log("⚠️  Event received but no ChatKit response\n");
      console.log("   Check if ChatKit is properly initialized\n");
    } else {
      console.log("❌ Event listener not working\n");
      console.log("   Check if ChatKitPanel is mounted\n");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

diagnose();
