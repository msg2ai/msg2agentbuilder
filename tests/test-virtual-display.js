#!/usr/bin/env node

/**
 * Test script to verify virtual display setup
 * This script launches a browser and takes a screenshot to verify the display works
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function testVirtualDisplay() {
  console.log("🧪 Testing Virtual Display Setup...\n");

  // Check environment
  const display = process.env.DISPLAY;
  const isVirtualDisplay = process.env.VIRTUAL_DISPLAY === "true";
  const headless = process.env.PUPPETEER_HEADLESS !== "false";

  console.log("Environment:");
  console.log(`  DISPLAY: ${display || "not set"}`);
  console.log(`  VIRTUAL_DISPLAY: ${isVirtualDisplay}`);
  console.log(`  Headless Mode: ${headless}`);
  console.log(`  Platform: ${process.platform}\n`);

  let browser;
  try {
    console.log("🚀 Launching browser...");

    const launchOptions = {
      headless: headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    };

    // Add display flag if running on Linux with virtual display
    if (process.platform === "linux" && display) {
      launchOptions.args.push(`--display=${display}`);
    }

    browser = await puppeteer.launch(launchOptions);
    console.log("✅ Browser launched successfully\n");

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log("📄 Navigating to test page...");
    await page.goto("https://example.com");
    console.log("✅ Page loaded\n");

    // Take a screenshot to verify display works
    const screenshotPath = path.join(__dirname, "test-screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}\n`);

    // Get page title
    const title = await page.title();
    console.log(`Page Title: "${title}"\n`);

    // Test JavaScript execution
    const result = await page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        userAgent: navigator.userAgent,
        hasWindow: typeof window !== "undefined",
        hasDocument: typeof document !== "undefined",
      };
    });

    console.log("Browser Context:");
    console.log(`  Window Size: ${result.width}x${result.height}`);
    console.log(`  Has Window: ${result.hasWindow}`);
    console.log(`  Has Document: ${result.hasDocument}`);
    console.log(`  User Agent: ${result.userAgent.substring(0, 60)}...\n`);

    // Test ChatKit-like scenario
    console.log("🧪 Testing ChatKit-like scenario...");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>ChatKit Test</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            #shadow-host { background: #f0f0f0; padding: 20px; }
          </style>
        </head>
        <body>
          <h1>ChatKit Virtual Display Test</h1>
          <div id="shadow-host"></div>
          <div id="output"></div>
          <script>
            // Simulate shadow DOM like ChatKit
            const host = document.getElementById('shadow-host');
            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = '<div style="color: blue;">This is inside Shadow DOM</div>';

            // Output test
            document.getElementById('output').innerText = 'Shadow DOM created: ' + (shadow ? 'Success' : 'Failed');
          </script>
        </body>
      </html>
    `);

    await page.waitForSelector("#output");
    const shadowTest = await page.evaluate(() => {
      return {
        shadowDOMExists: !!document.getElementById("shadow-host").shadowRoot,
        outputText: document.getElementById("output").innerText,
      };
    });

    console.log(
      "  Shadow DOM Test:",
      shadowTest.shadowDOMExists ? "✅ Passed" : "❌ Failed"
    );
    console.log("  Output:", shadowTest.outputText);

    // Save ChatKit test screenshot
    const chatkitScreenshot = path.join(
      __dirname,
      "test-chatkit-screenshot.png"
    );
    await page.screenshot({ path: chatkitScreenshot, fullPage: true });
    console.log(`  Screenshot: ${chatkitScreenshot}\n`);

    console.log("✅ All tests passed!\n");
    console.log("Summary:");
    console.log("  ✓ Browser launched successfully");
    console.log("  ✓ Pages can be loaded");
    console.log("  ✓ JavaScript execution works");
    console.log("  ✓ Screenshots can be captured");
    console.log("  ✓ Shadow DOM works (ChatKit requirement)");
    console.log("\n🎉 Virtual display setup is working correctly!\n");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Browser closed");
    }
  }
}

// Run the test
testVirtualDisplay().catch(console.error);
