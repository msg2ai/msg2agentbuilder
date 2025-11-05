#!/usr/bin/env node

/**
 * Capture ChatKit widget screenshot after full initialization
 */

const puppeteer = require("puppeteer");
const path = require("path");

async function captureChatKit() {
  console.log("📸 Capturing ChatKit Screenshot\n");

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== "false",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Enable console logging
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "log" || type === "info") {
        console.log(`  [Browser] ${text}`);
      } else if (type === "error" && !text.includes("net::ERR")) {
        console.log(`  [Browser Error] ${text}`);
      }
    });

    console.log("🌐 Loading AgentKit application...");
    await page.goto(appUrl, { waitUntil: "networkidle0", timeout: 30000 });
    console.log("✓ Initial page load complete\n");

    // Take screenshot immediately
    const screenshot1 = path.join(__dirname, "chatkit-immediate.png");
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`📸 Immediate: ${screenshot1}\n`);

    // Wait longer for ChatKit to initialize
    console.log("⏳ Waiting 20 seconds for ChatKit to fully initialize...");

    // Wait in intervals and log status
    for (let i = 1; i <= 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (i % 5 === 0) {
        const status = await page.evaluate(() => {
          const bodyText = document.body?.textContent || "";
          const hasLoading = bodyText.includes("Loading");
          const hasChat =
            bodyText.includes("chat") || bodyText.includes("Chat");
          const inputCount =
            document.querySelectorAll("input, textarea").length;
          const buttonCount = document.querySelectorAll("button").length;

          return {
            hasLoading,
            hasChat,
            inputCount,
            buttonCount,
            preview: bodyText.substring(0, 100).replace(/\s+/g, " "),
          };
        });

        console.log(
          `  [${i}s] Inputs: ${status.inputCount}, Buttons: ${status.buttonCount}, Loading: ${status.hasLoading}`,
        );
        console.log(`  [${i}s] Content: "${status.preview}..."`);
      }
    }
    console.log("✓ Wait complete\n");

    // Check final state
    console.log("🔍 Checking final state...");
    const finalState = await page.evaluate(() => {
      const allElements = document.querySelectorAll("*");
      const bodyText = document.body?.textContent || "";

      // Look for ChatKit indicators
      const chatKitElements = [];
      allElements.forEach((el) => {
        if (el.shadowRoot) {
          chatKitElements.push({
            tag: el.tagName,
            id: el.id,
            hasShadow: true,
          });
        }

        const attrs = Array.from(el.attributes || []);
        attrs.forEach((attr) => {
          if (
            attr.name.includes("chatkit") ||
            attr.value?.includes("chatkit")
          ) {
            chatKitElements.push({
              tag: el.tagName,
              attr: attr.name,
              value: attr.value,
            });
          }
        });
      });

      return {
        totalElements: allElements.length,
        bodyTextLength: bodyText.length,
        bodyPreview: bodyText.substring(0, 200).replace(/\s+/g, " "),
        inputCount: document.querySelectorAll("input").length,
        textareaCount: document.querySelectorAll("textarea").length,
        buttonCount: document.querySelectorAll("button").length,
        shadowDOMCount:
          document.querySelectorAll("*").length -
          Array.from(document.querySelectorAll("*")).filter(
            (el) => !el.shadowRoot,
          ).length,
        chatKitElements,
        hasLoadingText: bodyText.includes("Loading"),
        title: document.title,
      };
    });

    console.log(`  Title: ${finalState.title}`);
    console.log(`  Total elements: ${finalState.totalElements}`);
    console.log(`  Inputs: ${finalState.inputCount}`);
    console.log(`  Textareas: ${finalState.textareaCount}`);
    console.log(`  Buttons: ${finalState.buttonCount}`);
    console.log(`  Still loading: ${finalState.hasLoadingText}`);
    console.log(`  Text preview: "${finalState.bodyPreview}..."\n`);

    if (finalState.chatKitElements.length > 0) {
      console.log("  ChatKit elements found:");
      finalState.chatKitElements.forEach((el) => {
        console.log(
          `    - ${el.tag} ${el.id ? `id="${el.id}"` : ""} ${el.hasShadow ? "(has shadow)" : ""}`,
        );
      });
      console.log("");
    }

    // Capture final screenshots
    console.log("📸 Capturing final screenshots...\n");

    const fullPage = path.join(__dirname, "chatkit-fullpage.png");
    await page.screenshot({ path: fullPage, fullPage: true });
    console.log(`  ✓ Full page: ${fullPage}`);

    const viewport = path.join(__dirname, "chatkit-viewport.png");
    await page.screenshot({ path: viewport, fullPage: false });
    console.log(`  ✓ Viewport: ${viewport}`);

    // Try to capture just the main content area
    const mainElement = await page.$("main");
    if (mainElement) {
      const mainScreenshot = path.join(__dirname, "chatkit-main-only.png");
      await mainElement.screenshot({ path: mainScreenshot });
      console.log(`  ✓ Main element: ${mainScreenshot}`);
    }

    console.log("\n✅ Screenshots captured successfully!\n");

    // Return the most useful screenshot path
    return fullPage;
  } catch (error) {
    console.error("❌ Error:", error.message);

    // Try to capture error screenshot
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages[0]) {
          const errorScreenshot = path.join(__dirname, "chatkit-error.png");
          await pages[0].screenshot({ path: errorScreenshot, fullPage: true });
          console.log(`📸 Error screenshot: ${errorScreenshot}`);
        }
      } catch (e) {
        // Ignore
      }
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Browser closed");
    }
  }
}

captureChatKit()
  .then((screenshot) => {
    console.log(`\n🎉 Main screenshot saved to: ${screenshot}`);
  })
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
