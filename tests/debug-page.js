#!/usr/bin/env node

// Debug script to see what's on the page
const puppeteer = require("puppeteer");

async function debug() {
  console.log("Debugging page content...\n");

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Capture console logs
    page.on("console", (msg) => {
      console.log("[BROWSER CONSOLE]", msg.type(), msg.text());
    });

    // Capture page errors
    page.on("pageerror", (error) => {
      console.log("[PAGE ERROR]", error.message);
    });

    console.log("Navigating to http://localhost:3001...\n");
    await page.goto("http://localhost:3001", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    console.log("✅ Page loaded\n");

    // Check what's on window object
    const windowInfo = await page.evaluate(() => {
      return {
        hasChatkit: typeof window.chatkit !== "undefined",
        windowKeys: Object.keys(window).filter(
          (k) => k.includes("chat") || k.includes("Chat"),
        ),
        title: document.title,
        bodyText: document.body
          ? document.body.innerText.substring(0, 500)
          : "No body",
        hasReact: typeof window.React !== "undefined",
        hasNext: typeof window.next !== "undefined",
      };
    });

    console.log("Window Info:", JSON.stringify(windowInfo, null, 2));

    // Wait a bit more and check again
    console.log("\nWaiting 5 seconds for ChatKit to load...");
    await page.waitForTimeout(5000);

    const afterWait = await page.evaluate(() => {
      return {
        hasChatkit: typeof window.chatkit !== "undefined",
        windowKeys: Object.keys(window).filter(
          (k) => k.includes("chat") || k.includes("Chat"),
        ),
      };
    });

    console.log("After 5s wait:", JSON.stringify(afterWait, null, 2));

    await browser.close();
    console.log("\n✅ Debug complete!");
  } catch (error) {
    console.error("\n❌ Debug failed:", error.message);
  }
}

debug();
