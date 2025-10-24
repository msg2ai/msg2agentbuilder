#!/usr/bin/env node

/**
 * Test ChatKit in a VISIBLE browser (non-headless)
 * This helps debug if the issue is headless-specific
 */

const puppeteer = require("puppeteer");
const path = require("path");

async function testVisibleBrowser() {
  console.log("🔍 Testing ChatKit in VISIBLE Browser\n");
  console.log("A browser window will open. Please wait...\n");

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: false, // VISIBLE BROWSER
      devtools: true, // Open DevTools automatically
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Track important events
    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.includes("ChatKit") ||
        text.includes("session") ||
        text.includes("error") ||
        text.includes("ERROR")
      ) {
        console.log(`  [Browser ${msg.type()}] ${text}`);
      }
    });

    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("create-session") || url.includes("chatkit.js")) {
        console.log(`  [Request] ${request.method()} ${url}`);
      }
    });

    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("create-session")) {
        console.log(`  [Response] ${response.status()} ${url}`);
        try {
          const body = await response.json();
          console.log(`    Body:`, JSON.stringify(body).substring(0, 150));
        } catch (e) {
          // Ignore
        }
      } else if (url.includes("chatkit.js")) {
        console.log(
          `  [Response] ${response.status()} ${url} (${response.headers()["content-length"] || "unknown"} bytes)`
        );
      }
    });

    console.log("🌐 Opening:", appUrl);
    await page.goto(appUrl, { waitUntil: "networkidle0", timeout: 30000 });
    console.log("✓ Page loaded\n");

    console.log("⏳ Browser is now VISIBLE. Checking state every 5 seconds...");
    console.log("   Watch the browser window to see ChatKit load.\n");
    console.log("   Press Ctrl+C to stop.\n");

    // Monitor state every 5 seconds
    for (let i = 1; i <= 60; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (i % 5 === 0) {
        const state = await page.evaluate(() => {
          return {
            chatkitReady: window.__chatkitReady || false,
            bodyPreview: (document.body?.textContent || "")
              .substring(0, 200)
              .replace(/\s+/g, " "),
            hasLoading: (document.body?.textContent || "").includes("Loading"),
            hasChat: (document.body?.textContent || "")
              .toLowerCase()
              .includes("how can i help"),
            inputCount: document.querySelectorAll("input, textarea").length,
            buttonCount: document.querySelectorAll("button").length,
          };
        });

        console.log(`[${i}s]`);
        console.log(`  ChatKit Ready: ${state.chatkitReady}`);
        console.log(`  Loading State: ${state.hasLoading}`);
        console.log(`  Chat Visible: ${state.hasChat}`);
        console.log(
          `  Inputs: ${state.inputCount}, Buttons: ${state.buttonCount}`
        );
        console.log(`  Preview: "${state.bodyPreview.substring(0, 100)}..."`);

        // Take screenshot every 10 seconds
        if (i % 10 === 0) {
          const screenshot = path.join(__dirname, `chatkit-visible-${i}s.png`);
          await page.screenshot({ path: screenshot, fullPage: true });
          console.log(`  📸 Screenshot: ${screenshot}`);
        }

        console.log("");

        // If ChatKit loaded successfully, take a final screenshot and report
        if (state.chatkitReady && state.hasChat) {
          console.log("✅ SUCCESS! ChatKit has loaded!\n");
          const finalScreenshot = path.join(
            __dirname,
            "chatkit-visible-success.png"
          );
          await page.screenshot({ path: finalScreenshot, fullPage: true });
          console.log(`📸 Final screenshot: ${finalScreenshot}\n`);
          break;
        }

        // If still loading after 30 seconds, something is wrong
        if (i >= 30 && state.hasLoading && !state.chatkitReady) {
          console.log(
            "⚠️  Still loading after 30 seconds. This may indicate an issue.\n"
          );
        }
      }
    }

    console.log(
      "\n═══════════════════════════════════════════════════════════"
    );
    console.log("Browser will stay open for 30 more seconds for inspection.");
    console.log("Check the DevTools console for any errors.");
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );

    await new Promise((resolve) => setTimeout(resolve, 30000));

    console.log("✅ Test complete!\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }

    // Keep browser open on error for debugging
    console.log(
      "\n⚠️  Error occurred. Browser will stay open for 30 seconds for debugging...\n"
    );
    await new Promise((resolve) => setTimeout(resolve, 30000));
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Browser closed");
    }
  }
}

testVisibleBrowser().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
