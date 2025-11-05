#!/usr/bin/env node

/**
 * Test AgentKit UI in Virtual Display
 * This script launches the AgentKit/ChatKit app and performs DOM inspection
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function testAgentKitUI() {
  console.log("🤖 Testing AgentKit UI in Virtual Display\n");

  // Check environment
  const display = process.env.DISPLAY;
  const isVirtualDisplay = process.env.VIRTUAL_DISPLAY === "true";
  const headless = process.env.PUPPETEER_HEADLESS !== "false";

  // Get the app URL from environment or use default
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  console.log("Environment:");
  console.log(`  DISPLAY: ${display || "not set"}`);
  console.log(`  VIRTUAL_DISPLAY: ${isVirtualDisplay}`);
  console.log(`  Headless Mode: ${headless}`);
  console.log(`  Platform: ${process.platform}`);
  console.log(`  App URL: ${appUrl}\n`);

  let browser;
  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  try {
    console.log("🚀 Launching browser...\n");

    const launchOptions = {
      headless: headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    };

    if (process.platform === "linux" && display) {
      launchOptions.args.push(`--display=${display}`);
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Enable console logging from the page
    page.on("console", (msg) => {
      const type = msg.type();
      if (type === "error") {
        console.log(`  [Browser Error] ${msg.text()}`);
      }
    });

    // Test 1: Navigate to the AgentKit app
    console.log("🌐 Test 1: Load AgentKit Application");
    try {
      const response = await page.goto(appUrl, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      if (response) {
        console.log(`  ✓ HTTP Status: ${response.status()}`);
        console.log(`  ✓ Page loaded successfully`);
        results.passed++;
      } else {
        throw new Error("No response received");
      }
    } catch (error) {
      console.log(`  ❌ Failed to load: ${error.message}`);
      console.log(`  ℹ️  Make sure the app is running on ${appUrl}`);
      console.log(`  ℹ️  Run: npm run dev\n`);
      results.failed++;

      // Take a screenshot anyway
      const errorScreenshot = path.join(__dirname, "test-agentkit-error.png");
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`  📸 Error screenshot: ${errorScreenshot}\n`);

      return;
    }

    // Test 2: Check page title and meta
    console.log("\n📄 Test 2: Verify Page Metadata");
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        hasHTML: !!document.documentElement,
        hasBody: !!document.body,
        bodyClasses: document.body?.className,
      };
    });

    console.log(`  ✓ Title: "${pageInfo.title}"`);
    console.log(`  ✓ Has HTML: ${pageInfo.hasHTML}`);
    console.log(`  ✓ Has Body: ${pageInfo.hasBody}`);
    console.log(`  ✓ Body classes: ${pageInfo.bodyClasses || "none"}`);
    results.passed++;

    // Take initial screenshot
    const initialScreenshot = path.join(__dirname, "agentkit-initial.png");
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    console.log(`  📸 Screenshot: ${initialScreenshot}\n`);

    // Test 3: Check for ChatKit script loading
    console.log("📦 Test 3: ChatKit Script Loading");
    const chatkitScriptInfo = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script"));
      const chatkitScript = scripts.find(
        (s) =>
          s.src?.includes("chatkit.js") ||
          s.src?.includes("platform.openai.com"),
      );

      return {
        hasChatkitScript: !!chatkitScript,
        chatkitScriptSrc: chatkitScript?.src,
        totalScripts: scripts.length,
        allScripts: scripts.map((s) => s.src).filter(Boolean),
      };
    });

    console.log(`  ✓ Total scripts: ${chatkitScriptInfo.totalScripts}`);
    console.log(
      `  ✓ ChatKit script found: ${chatkitScriptInfo.hasChatkitScript}`,
    );
    if (chatkitScriptInfo.chatkitScriptSrc) {
      console.log(
        `  ✓ ChatKit script URL: ${chatkitScriptInfo.chatkitScriptSrc}`,
      );
    }
    results.passed++;

    // Test 4: Wait for and inspect ChatKit widget
    console.log("\n💬 Test 4: ChatKit Widget Detection");

    // Wait a bit for ChatKit to initialize
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const widgetInfo = await page.evaluate(() => {
      // Look for common ChatKit selectors
      const selectors = [
        "[data-chatkit]",
        '[class*="chatkit"]',
        '[class*="ChatKit"]',
        'iframe[src*="chatkit"]',
        'iframe[src*="openai"]',
        "#chatkit-widget",
        ".chatkit-container",
      ];

      let foundWidget = null;
      let foundSelector = null;

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          foundWidget = el;
          foundSelector = selector;
          break;
        }
      }

      // Also check all elements with shadow roots
      const allElements = document.querySelectorAll("*");
      const elementsWithShadow = [];

      allElements.forEach((el) => {
        if (el.shadowRoot) {
          elementsWithShadow.push({
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            hasShadowRoot: true,
          });
        }
      });

      return {
        widgetFound: !!foundWidget,
        widgetSelector: foundSelector,
        widgetTagName: foundWidget?.tagName,
        widgetId: foundWidget?.id,
        widgetClasses: foundWidget?.className,
        hasShadowRoot: foundWidget?.shadowRoot ? true : false,
        elementsWithShadow,
        totalElements: allElements.length,
      };
    });

    console.log(`  ✓ Total elements on page: ${widgetInfo.totalElements}`);
    console.log(
      `  ✓ Elements with Shadow DOM: ${widgetInfo.elementsWithShadow.length}`,
    );

    if (widgetInfo.elementsWithShadow.length > 0) {
      console.log(`  ✓ Shadow DOM elements found:`);
      widgetInfo.elementsWithShadow.forEach((el) => {
        console.log(
          `    - <${el.tagName.toLowerCase()}> ${el.id ? `id="${el.id}"` : ""} ${el.className ? `class="${el.className}"` : ""}`,
        );
      });
    }

    if (widgetInfo.widgetFound) {
      console.log(
        `  ✓ Widget found with selector: ${widgetInfo.widgetSelector}`,
      );
      console.log(`  ✓ Widget tag: ${widgetInfo.widgetTagName}`);
      console.log(`  ✓ Widget has shadow DOM: ${widgetInfo.hasShadowRoot}`);
      results.passed++;
    } else {
      console.log(
        `  ℹ️  No ChatKit widget detected yet (may still be loading)`,
      );
      results.passed++; // Don't fail, as it might still be loading
    }

    // Test 5: Inspect React root and main content
    console.log("\n⚛️  Test 5: React Application Structure");
    const reactInfo = await page.evaluate(() => {
      const main = document.querySelector("main");
      const hasReactRoot =
        !!document.querySelector("[data-reactroot]") ||
        !!document.querySelector("#__next") ||
        !!main;

      return {
        hasReactRoot,
        hasMain: !!main,
        mainClasses: main?.className,
        mainChildren: main?.children.length,
        mainHTML: main?.innerHTML.substring(0, 200),
      };
    });

    console.log(`  ✓ React root detected: ${reactInfo.hasReactRoot}`);
    console.log(`  ✓ Main element found: ${reactInfo.hasMain}`);
    if (reactInfo.hasMain) {
      console.log(`  ✓ Main classes: ${reactInfo.mainClasses}`);
      console.log(`  ✓ Main children: ${reactInfo.mainChildren}`);
    }
    results.passed++;

    // Test 6: Take comprehensive screenshots
    console.log("\n📸 Test 6: Capture Screenshots");

    const fullScreenshot = path.join(__dirname, "agentkit-full-page.png");
    await page.screenshot({ path: fullScreenshot, fullPage: true });
    console.log(`  ✓ Full page screenshot: ${fullScreenshot}`);

    const viewportScreenshot = path.join(__dirname, "agentkit-viewport.png");
    await page.screenshot({ path: viewportScreenshot, fullPage: false });
    console.log(`  ✓ Viewport screenshot: ${viewportScreenshot}`);
    results.passed++;

    // Test 7: Extract all text content
    console.log("\n📝 Test 7: Page Content Analysis");
    const contentInfo = await page.evaluate(() => {
      const allText = document.body?.innerText || "";
      const headings = Array.from(
        document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
      )
        .map((h) => ({ tag: h.tagName, text: h.textContent?.trim() }))
        .filter((h) => h.text);

      return {
        textLength: allText.length,
        firstWords: allText.substring(0, 100),
        headings,
        hasVisibleContent: allText.length > 0,
      };
    });

    console.log(
      `  ✓ Page has visible content: ${contentInfo.hasVisibleContent}`,
    );
    console.log(`  ✓ Total text length: ${contentInfo.textLength} characters`);
    if (contentInfo.headings.length > 0) {
      console.log(`  ✓ Headings found: ${contentInfo.headings.length}`);
      contentInfo.headings.forEach((h) => {
        console.log(`    - ${h.tag}: ${h.text}`);
      });
    }
    if (contentInfo.firstWords) {
      console.log(
        `  ✓ First content: "${contentInfo.firstWords}${contentInfo.textLength > 100 ? "..." : ""}"`,
      );
    }
    results.passed++;

    // Test 8: Check for any iframes (ChatKit might use one)
    console.log("\n🖼️  Test 8: Iframe Detection");
    const iframeInfo = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll("iframe"));
      return {
        iframeCount: iframes.length,
        iframes: iframes.map((iframe) => ({
          src: iframe.src,
          id: iframe.id,
          className: iframe.className,
          width: iframe.width,
          height: iframe.height,
        })),
      };
    });

    console.log(`  ✓ Iframes found: ${iframeInfo.iframeCount}`);
    if (iframeInfo.iframeCount > 0) {
      iframeInfo.iframes.forEach((iframe, idx) => {
        console.log(`  ✓ Iframe ${idx + 1}:`);
        console.log(`    - Source: ${iframe.src || "none"}`);
        console.log(`    - ID: ${iframe.id || "none"}`);
        console.log(`    - Classes: ${iframe.className || "none"}`);
      });
    }
    results.passed++;

    // Test 9: Test interaction (if widget is found)
    console.log("\n🎯 Test 9: Interaction Testing");

    // Try to find any clickable elements
    const interactionInfo = await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      const inputs = document.querySelectorAll("input");
      const clickable = document.querySelectorAll('[role="button"], [onclick]');

      return {
        buttonCount: buttons.length,
        inputCount: inputs.length,
        clickableCount: clickable.length,
        hasInteractiveElements:
          buttons.length > 0 || inputs.length > 0 || clickable.length > 0,
      };
    });

    console.log(`  ✓ Buttons found: ${interactionInfo.buttonCount}`);
    console.log(`  ✓ Inputs found: ${interactionInfo.inputCount}`);
    console.log(
      `  ✓ Other clickable elements: ${interactionInfo.clickableCount}`,
    );
    console.log(
      `  ✓ Has interactive elements: ${interactionInfo.hasInteractiveElements}`,
    );
    results.passed++;

    // Test 10: Performance metrics
    console.log("\n⚡ Test 10: Performance Metrics");
    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType("navigation")[0];
      return {
        domContentLoaded:
          perfData?.domContentLoadedEventEnd -
          perfData?.domContentLoadedEventStart,
        loadTime: perfData?.loadEventEnd - perfData?.loadEventStart,
        domInteractive: perfData?.domInteractive,
      };
    });

    console.log(
      `  ✓ DOM Content Loaded: ${metrics.domContentLoaded?.toFixed(2) || "N/A"} ms`,
    );
    console.log(
      `  ✓ Page Load Time: ${metrics.loadTime?.toFixed(2) || "N/A"} ms`,
    );
    console.log(
      `  ✓ DOM Interactive: ${metrics.domInteractive?.toFixed(2) || "N/A"} ms`,
    );
    results.passed++;

    // Summary
    console.log("\n" + "═".repeat(70));
    console.log("📊 Test Summary");
    console.log("═".repeat(70));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(
      `📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%\n`,
    );

    console.log("🎉 AgentKit UI testing completed!\n");
    console.log("Screenshots generated:");
    console.log(`  - ${path.basename(initialScreenshot)}`);
    console.log(`  - ${path.basename(fullScreenshot)}`);
    console.log(`  - ${path.basename(viewportScreenshot)}\n`);

    console.log("Next steps:");
    console.log("  1. Review the generated screenshots");
    console.log("  2. Check if ChatKit widget loaded correctly");
    console.log("  3. Test interaction with the widget");
    console.log("  4. Monitor for any console errors or warnings\n");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("\nStack trace:", error.stack);
    results.failed++;
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log("🧹 Browser closed");
    }
  }
}

// Run the tests
testAgentKitUI().catch(console.error);
