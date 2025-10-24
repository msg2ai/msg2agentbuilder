#!/usr/bin/env node

/**
 * Deep inspection of ChatKit widget in AgentKit UI
 * Waits for full loading and inspects Shadow DOM
 */

const puppeteer = require("puppeteer");
const path = require("path");

async function testChatKitWidget() {
  console.log("🔍 Deep ChatKit Widget Inspection\n");

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

    console.log("🌐 Loading AgentKit application...");
    await page.goto(appUrl, { waitUntil: "networkidle0" });
    console.log("✓ Page loaded\n");

    // Wait longer for ChatKit to fully initialize
    console.log("⏳ Waiting for ChatKit to initialize (10 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log("✓ Wait complete\n");

    // Take screenshot after waiting
    const afterWaitScreenshot = path.join(__dirname, "agentkit-after-wait.png");
    await page.screenshot({ path: afterWaitScreenshot, fullPage: true });
    console.log(`📸 Screenshot after wait: ${afterWaitScreenshot}\n`);

    // Comprehensive DOM inspection
    console.log("🔍 Inspecting DOM structure...\n");
    const inspection = await page.evaluate(() => {
      const results = {
        timestamp: new Date().toISOString(),
        allElements: [],
        shadowDOMElements: [],
        chatkitElements: [],
        iframes: [],
        buttons: [],
        inputs: [],
        loadingText: null,
      };

      // Find all elements
      const all = document.querySelectorAll("*");

      all.forEach((el) => {
        const info = {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: el.className || null,
          hasShadow: !!el.shadowRoot,
          text: el.textContent?.trim().substring(0, 50) || null,
        };

        // Check for ChatKit-related attributes or classes
        const isChatKit =
          (el.id && el.id.includes("chatkit")) ||
          (el.className &&
            typeof el.className === "string" &&
            el.className.toLowerCase().includes("chatkit")) ||
          (el.getAttribute &&
            (el.getAttribute("data-chatkit") ||
              el.getAttribute("data-openai")));

        if (isChatKit) {
          results.chatkitElements.push({
            ...info,
            attributes: Array.from(el.attributes || []).map((a) => ({
              name: a.name,
              value: a.value,
            })),
          });
        }

        // Shadow DOM elements
        if (el.shadowRoot) {
          const shadowContent = {
            host: info,
            shadowHTML: el.shadowRoot.innerHTML?.substring(0, 500),
            shadowChildren: el.shadowRoot.children.length,
            shadowElements: [],
          };

          // Inspect shadow DOM content
          const shadowEls = el.shadowRoot.querySelectorAll("*");
          shadowEls.forEach((shadowEl) => {
            shadowContent.shadowElements.push({
              tag: shadowEl.tagName.toLowerCase(),
              id: shadowEl.id || null,
              classes: shadowEl.className || null,
              text: shadowEl.textContent?.trim().substring(0, 50) || null,
            });
          });

          results.shadowDOMElements.push(shadowContent);
        }

        // Collect buttons
        if (el.tagName === "BUTTON") {
          results.buttons.push({
            text: el.textContent?.trim(),
            id: el.id,
            classes: el.className,
            type: el.type,
          });
        }

        // Collect inputs
        if (el.tagName === "INPUT") {
          results.inputs.push({
            type: el.type,
            id: el.id,
            placeholder: el.placeholder,
            value: el.value,
          });
        }

        // Collect iframes
        if (el.tagName === "IFRAME") {
          results.iframes.push({
            src: el.src,
            id: el.id,
            classes: el.className,
          });
        }
      });

      // Check for loading text
      const bodyText = document.body?.textContent || "";
      if (bodyText.includes("Loading")) {
        results.loadingText = bodyText.match(/Loading[^.\n]*/)?.[0];
      }

      // Check for ChatKit global objects
      results.windowObjects = {
        hasChatKit: typeof window.ChatKit !== "undefined",
        hasOpenAI: typeof window.OpenAI !== "undefined",
        allGlobals: Object.keys(window).filter(
          (k) =>
            k.toLowerCase().includes("chat") ||
            k.toLowerCase().includes("openai") ||
            k.toLowerCase().includes("agent")
        ),
      };

      return results;
    });

    // Display results
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📊 INSPECTION RESULTS");
    console.log(
      "═══════════════════════════════════════════════════════════\n"
    );

    console.log(`🕐 Timestamp: ${inspection.timestamp}\n`);

    if (inspection.loadingText) {
      console.log(`⏳ Loading Status: ${inspection.loadingText}\n`);
    }

    console.log("🌐 Window Objects:");
    console.log(`  ChatKit defined: ${inspection.windowObjects.hasChatKit}`);
    console.log(`  OpenAI defined: ${inspection.windowObjects.hasOpenAI}`);
    console.log(
      `  Related globals: ${inspection.windowObjects.allGlobals.join(", ") || "none"}\n`
    );

    console.log("🔍 ChatKit-specific Elements:");
    if (inspection.chatkitElements.length > 0) {
      inspection.chatkitElements.forEach((el, i) => {
        console.log(`  Element ${i + 1}:`);
        console.log(`    Tag: <${el.tag}>`);
        console.log(`    ID: ${el.id || "none"}`);
        console.log(`    Classes: ${el.classes || "none"}`);
        console.log(`    Has Shadow: ${el.hasShadow}`);
        if (el.attributes && el.attributes.length > 0) {
          console.log(`    Attributes:`);
          el.attributes.forEach((attr) => {
            console.log(`      ${attr.name}="${attr.value}"`);
          });
        }
        console.log("");
      });
    } else {
      console.log("  No ChatKit-specific elements found\n");
    }

    console.log("🌑 Shadow DOM Elements:");
    if (inspection.shadowDOMElements.length > 0) {
      inspection.shadowDOMElements.forEach((shadow, i) => {
        console.log(`  Shadow Root ${i + 1}:`);
        console.log(
          `    Host: <${shadow.host.tag}> ${shadow.host.id ? `id="${shadow.host.id}"` : ""} ${shadow.host.classes ? `class="${shadow.host.classes}"` : ""}`
        );
        console.log(`    Children: ${shadow.shadowChildren}`);
        console.log(`    Elements inside: ${shadow.shadowElements.length}`);
        if (shadow.shadowHTML) {
          console.log(
            `    HTML preview: ${shadow.shadowHTML.substring(0, 100)}...`
          );
        }
        if (
          shadow.shadowElements.length > 0 &&
          shadow.shadowElements.length <= 10
        ) {
          console.log(`    Shadow elements:`);
          shadow.shadowElements.forEach((el) => {
            console.log(
              `      - <${el.tag}> ${el.id ? `id="${el.id}"` : ""} ${el.text ? `"${el.text}"` : ""}`
            );
          });
        }
        console.log("");
      });
    } else {
      console.log(
        "  No custom shadow DOM elements found (only Next.js portals)\n"
      );
    }

    console.log("🔘 Buttons:");
    if (inspection.buttons.length > 0) {
      inspection.buttons.forEach((btn) => {
        console.log(`  - "${btn.text}" ${btn.id ? `(id: ${btn.id})` : ""}`);
      });
      console.log("");
    } else {
      console.log("  No buttons found\n");
    }

    console.log("📝 Inputs:");
    if (inspection.inputs.length > 0) {
      inspection.inputs.forEach((input) => {
        console.log(
          `  - Type: ${input.type}, Placeholder: "${input.placeholder || "none"}" ${input.id ? `(id: ${input.id})` : ""}`
        );
      });
      console.log("");
    } else {
      console.log("  No inputs found\n");
    }

    console.log("🖼️  Iframes:");
    if (inspection.iframes.length > 0) {
      inspection.iframes.forEach((iframe) => {
        console.log(`  - Source: ${iframe.src || "none"}`);
        console.log(`    ID: ${iframe.id || "none"}`);
        console.log(`    Classes: ${iframe.classes || "none"}`);
      });
      console.log("");
    } else {
      console.log("  No iframes found\n");
    }

    // Try to find ChatKit panel component
    console.log("🔍 Looking for ChatKit Panel component...\n");
    const panelInfo = await page.evaluate(() => {
      // Look for common React component patterns
      const allDivs = document.querySelectorAll("div");
      const suspiciousDivs = [];

      allDivs.forEach((div) => {
        const hasDataProps = Array.from(div.attributes || []).some((attr) =>
          attr.name.startsWith("data-")
        );

        const hasReactProps =
          div.className &&
          (div.className.includes("chatkit") ||
            div.className.includes("panel") ||
            div.className.includes("assistant"));

        if (hasDataProps || hasReactProps) {
          suspiciousDivs.push({
            id: div.id,
            classes: div.className,
            attributes: Array.from(div.attributes || []).map((a) => ({
              name: a.name,
              value: a.value,
            })),
            childrenCount: div.children.length,
            text: div.textContent?.trim().substring(0, 100),
          });
        }
      });

      return suspiciousDivs;
    });

    if (panelInfo.length > 0) {
      console.log("Found potential ChatKit panel components:");
      panelInfo.forEach((panel, i) => {
        console.log(`  Component ${i + 1}:`);
        console.log(`    ID: ${panel.id || "none"}`);
        console.log(`    Classes: ${panel.classes || "none"}`);
        console.log(`    Children: ${panel.childrenCount}`);
        console.log(`    Text: ${panel.text || "none"}`);
        console.log("");
      });
    }

    // Final screenshots
    console.log("📸 Taking final screenshots...\n");

    const finalFull = path.join(__dirname, "agentkit-chatkit-full.png");
    await page.screenshot({ path: finalFull, fullPage: true });
    console.log(`  ✓ Full page: ${finalFull}`);

    const finalViewport = path.join(__dirname, "agentkit-chatkit-viewport.png");
    await page.screenshot({ path: finalViewport, fullPage: false });
    console.log(`  ✓ Viewport: ${finalViewport}\n`);

    console.log("✅ Inspection complete!\n");

    // Save detailed results to JSON
    const resultsPath = path.join(
      __dirname,
      "agentkit-inspection-results.json"
    );
    require("fs").writeFileSync(
      resultsPath,
      JSON.stringify(inspection, null, 2)
    );
    console.log(`📄 Detailed results saved to: ${resultsPath}\n`);
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

testChatKitWidget().catch(console.error);
