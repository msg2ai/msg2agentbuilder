#!/usr/bin/env node

/**
 * Debug ChatKit loading issues
 * Captures detailed console logs and network requests
 */

const puppeteer = require("puppeteer");
const path = require("path");

async function debugChatKitLoading() {
  console.log("🔍 Debugging ChatKit Loading\n");

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

    // Track all requests and responses
    const requests = [];
    const responses = [];
    const consoleLogs = [];

    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("create-session") ||
        url.includes("chatkit") ||
        url.includes("openai")
      ) {
        requests.push({
          timestamp: Date.now(),
          method: request.method(),
          url,
          headers: request.headers(),
        });
        console.log(`  [Request] ${request.method()} ${url}`);
      }
    });

    page.on("response", async (response) => {
      const url = response.url();
      if (
        url.includes("create-session") ||
        url.includes("chatkit") ||
        url.includes("openai")
      ) {
        const responseData = {
          timestamp: Date.now(),
          url,
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
        };

        // Try to get response body
        try {
          const contentType = response.headers()["content-type"] || "";
          if (contentType.includes("json")) {
            responseData.body = await response.json();
          } else {
            responseData.bodyPreview = (await response.text()).substring(
              0,
              200,
            );
          }
        } catch (e) {
          responseData.bodyError = e.message;
        }

        responses.push(responseData);
        console.log(`  [Response] ${response.status()} ${url}`);
        if (responseData.body) {
          console.log(
            `    Body:`,
            JSON.stringify(responseData.body).substring(0, 150),
          );
        }
      }
    });

    page.on("console", (msg) => {
      const text = msg.text();
      consoleLogs.push({ type: msg.type(), text, timestamp: Date.now() });

      // Log important messages
      if (
        text.includes("ChatKit") ||
        text.includes("session") ||
        text.includes("ERROR") ||
        text.includes("error")
      ) {
        console.log(`  [Browser ${msg.type()}] ${text}`);
      }
    });

    page.on("pageerror", (error) => {
      console.log(`  [Page Error] ${error.message}`);
    });

    console.log("🌐 Loading application...\n");
    await page.goto(appUrl, { waitUntil: "networkidle2", timeout: 30000 });
    console.log("✓ Page loaded\n");

    // Wait a bit for initialization
    console.log("⏳ Waiting 15 seconds for ChatKit initialization...\n");
    for (let i = 1; i <= 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (i % 5 === 0) {
        // Check state every 5 seconds
        const state = await page.evaluate(() => {
          return {
            chatkitReady: window.__chatkitReady || false,
            bodyText: (document.body?.textContent || "").substring(0, 150),
            isLoading: (document.body?.textContent || "").includes("Loading"),
          };
        });
        console.log(
          `  [${i}s] Ready: ${state.chatkitReady}, Loading: ${state.isLoading}`,
        );
      }
    }

    console.log("\n📸 Taking screenshot...");
    const screenshot = path.join(__dirname, "chatkit-debug.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log(`  ✓ ${screenshot}\n`);

    // Final state check
    const finalState = await page.evaluate(() => {
      // Check for any visible errors
      const errorElements = [];
      document.querySelectorAll("*").forEach((el) => {
        const text = el.textContent;
        if (
          text &&
          (text.includes("error") ||
            text.includes("Error") ||
            text.includes("failed") ||
            text.includes("Failed"))
        ) {
          errorElements.push({
            tag: el.tagName,
            text: text.substring(0, 100),
          });
        }
      });

      return {
        chatkitReady: window.__chatkitReady || false,
        title: document.title,
        bodyText: (document.body?.textContent || "").substring(0, 300),
        isLoading: (document.body?.textContent || "").includes("Loading"),
        errorElements: errorElements.slice(0, 5),
        totalElements: document.querySelectorAll("*").length,
      };
    });

    console.log("═══════════════════════════════════════════════════════════");
    console.log("📊 FINAL STATE");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );
    console.log(`Title: ${finalState.title}`);
    console.log(`ChatKit Ready: ${finalState.chatkitReady}`);
    console.log(`Still Loading: ${finalState.isLoading}`);
    console.log(`Total Elements: ${finalState.totalElements}`);
    console.log(`\nBody Text:\n${finalState.bodyText}\n`);

    if (finalState.errorElements.length > 0) {
      console.log("⚠️  Potential errors found:");
      finalState.errorElements.forEach((el, i) => {
        console.log(`  ${i + 1}. <${el.tag}>: ${el.text}`);
      });
      console.log("");
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("🌐 NETWORK ACTIVITY");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );
    console.log(`Total Requests: ${requests.length}`);
    console.log(`Total Responses: ${responses.length}\n`);

    if (requests.length > 0) {
      console.log("Requests:");
      requests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method} ${req.url}`);
      });
      console.log("");
    }

    if (responses.length > 0) {
      console.log("Responses:");
      responses.forEach((res, i) => {
        console.log(`  ${i + 1}. ${res.status} ${res.url}`);
        if (res.body) {
          console.log(
            `     Body: ${JSON.stringify(res.body).substring(0, 100)}...`,
          );
        }
      });
      console.log("");
    }

    console.log("═══════════════════════════════════════════════════════════");
    console.log("💬 CONSOLE MESSAGES (last 20)");
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );
    const recentLogs = consoleLogs.slice(-20);
    recentLogs.forEach((log, i) => {
      console.log(`  [${log.type}] ${log.text.substring(0, 150)}`);
    });

    console.log("\n✅ Debug complete!\n");

    // Save detailed report
    const report = {
      finalState,
      requests,
      responses,
      consoleLogs: consoleLogs.slice(-50),
      timestamp: new Date().toISOString(),
    };

    require("fs").writeFileSync(
      path.join(__dirname, "chatkit-debug-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log("📄 Detailed report saved to: chatkit-debug-report.json\n");
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

debugChatKitLoading().catch(console.error);
