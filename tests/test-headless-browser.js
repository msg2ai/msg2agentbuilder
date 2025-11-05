#!/usr/bin/env node

// Test script to verify headless browser setup
const puppeteer = require("puppeteer");

async function test() {
  console.log("Testing headless browser setup...\n");

  try {
    console.log("1. Launching headless Chromium...");
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    console.log("✅ Browser launched successfully\n");

    console.log("2. Creating new page...");
    const page = await browser.newPage();
    console.log("✅ Page created\n");

    console.log("3. Navigating to http://localhost:3001...");
    console.log("   (Make sure dev server is running with: npm run dev)\n");

    await page.goto("http://localhost:3001", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    console.log("✅ Page loaded\n");

    console.log("4. Checking if ChatKit is available...");
    const chatkitAvailable = await page.evaluate(() => {
      return typeof window.chatkit !== "undefined";
    });

    if (chatkitAvailable) {
      console.log("✅ ChatKit is loaded!\n");

      console.log("5. Getting ChatKit info...");
      const chatkitInfo = await page.evaluate(() => {
        return {
          hasControl: typeof window.chatkit.control !== "undefined",
          hasSendMessage:
            typeof window.chatkit.control?.sendMessage === "function",
        };
      });

      console.log("   Control API:", chatkitInfo.hasControl ? "✅" : "❌");
      console.log(
        "   sendMessage():",
        chatkitInfo.hasSendMessage ? "✅" : "❌",
      );
      console.log("");
    } else {
      console.log("❌ ChatKit not found on the page\n");
      console.log("Troubleshooting:");
      console.log(
        "- Is http://localhost:3000 showing the ChatKit UI in a browser?",
      );
      console.log("- Check browser console for errors");
      console.log("- Make sure NEXT_PUBLIC_WORKFLOW_ID is set in .env.local");
    }

    await browser.close();
    console.log("\n✅ Test complete!");
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);

    if (error.message.includes("ERR_CONNECTION_REFUSED")) {
      console.log("\nTroubleshooting:");
      console.log("- Start the dev server: npm run dev");
      console.log("- Make sure it's running on http://localhost:3000");
    } else if (error.message.includes("Failed to launch")) {
      console.log("\nTroubleshooting:");
      console.log("- Install Chromium: brew install chromium");
      console.log(
        "- Or let Puppeteer download it: npx puppeteer browsers install chrome",
      );
    }
  }
}

test();
