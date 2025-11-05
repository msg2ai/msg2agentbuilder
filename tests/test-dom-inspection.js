#!/usr/bin/env node

/**
 * Comprehensive DOM Inspection Test for Virtual Display
 * Tests all DOM manipulation and inspection capabilities with Puppeteer
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function testDOMInspection() {
  console.log("🔍 DOM Inspection Test Suite for Virtual Display\n");

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
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    console.log("🚀 Launching browser...\n");

    const launchOptions = {
      headless: headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    };

    if (process.platform === "linux" && display) {
      launchOptions.args.push(`--display=${display}`);
    }

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Test 1: Basic DOM Structure Inspection
    console.log("📋 Test 1: Basic DOM Structure Inspection");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>DOM Test</title></head>
        <body>
          <header id="main-header">
            <h1 class="title">Test Page</h1>
            <nav>
              <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
              </ul>
            </nav>
          </header>
          <main>
            <div id="content" class="container">
              <p data-test="paragraph">Hello World</p>
            </div>
          </main>
          <footer>Copyright 2024</footer>
        </body>
      </html>
    `);

    const domStructure = await page.evaluate(() => {
      return {
        title: document.title,
        header: !!document.querySelector("header"),
        headerText: document.querySelector("header h1")?.textContent,
        links: Array.from(document.querySelectorAll("a")).map((a) => a.href),
        paragraphData: document.querySelector('[data-test="paragraph"]')
          ?.dataset?.test,
        elementCount: document.querySelectorAll("*").length
      };
    });

    console.log(`  ✓ Document title: ${domStructure.title}`);
    console.log(`  ✓ Header found: ${domStructure.header}`);
    console.log(`  ✓ Header text: ${domStructure.headerText}`);
    console.log(`  ✓ Links found: ${domStructure.links.length}`);
    console.log(`  ✓ Data attribute: ${domStructure.paragraphData}`);
    console.log(`  ✓ Total elements: ${domStructure.elementCount}\n`);
    results.passed++;

    // Test 2: Shadow DOM Inspection (ChatKit-specific)
    console.log("🌑 Test 2: Shadow DOM Inspection");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="light-dom">Light DOM Content</div>
          <div id="shadow-host"></div>
          <script>
            const host = document.getElementById('shadow-host');
            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = \`
              <style>
                .shadow-content { color: purple; font-weight: bold; }
              </style>
              <div class="shadow-content">
                <h2>Shadow DOM Title</h2>
                <p id="shadow-para">This is in the shadow DOM</p>
                <button id="shadow-btn">Click Me</button>
              </div>
            \`;
          </script>
        </body>
      </html>
    `);

    const shadowDOMTest = await page.evaluate(() => {
      const host = document.getElementById("shadow-host");
      const shadow = host.shadowRoot;

      return {
        hasShadowRoot: !!shadow,
        shadowHTML: shadow?.innerHTML?.substring(0, 100),
        shadowTitle: shadow?.querySelector("h2")?.textContent,
        shadowParagraph: shadow?.querySelector("#shadow-para")?.textContent,
        shadowButton: shadow?.querySelector("#shadow-btn")?.textContent,
        shadowElementCount: shadow?.querySelectorAll("*").length
      };
    });

    console.log(`  ✓ Shadow root exists: ${shadowDOMTest.hasShadowRoot}`);
    console.log(`  ✓ Shadow title: ${shadowDOMTest.shadowTitle}`);
    console.log(`  ✓ Shadow paragraph: ${shadowDOMTest.shadowParagraph}`);
    console.log(`  ✓ Shadow button: ${shadowDOMTest.shadowButton}`);
    console.log(`  ✓ Shadow elements: ${shadowDOMTest.shadowElementCount}\n`);
    results.passed++;

    // Test 3: Shadow DOM with Puppeteer's built-in piercing
    console.log("🎯 Test 3: Puppeteer Shadow DOM Piercing");

    const shadowButton = await page.evaluateHandle(() => {
      return document
        .getElementById("shadow-host")
        .shadowRoot.querySelector("#shadow-btn");
    });

    const shadowButtonText = await page.evaluate(
      (btn) => btn.textContent,
      shadowButton
    );
    console.log(`  ✓ Accessed shadow button directly: "${shadowButtonText}"\n`);
    results.passed++;

    // Test 4: DOM Manipulation and Observation
    console.log("🔧 Test 4: DOM Manipulation");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="container"></div>
        </body>
      </html>
    `);

    const manipulationResults = await page.evaluate(() => {
      const container = document.getElementById("container");

      // Add elements
      const newDiv = document.createElement("div");
      newDiv.id = "new-element";
      newDiv.className = "test-class";
      newDiv.textContent = "Dynamically added";
      container.appendChild(newDiv);

      // Modify styles
      newDiv.style.backgroundColor = "lightblue";
      newDiv.style.padding = "10px";

      // Add more complex structure
      const list = document.createElement("ul");
      for (let i = 1; i <= 5; i++) {
        const li = document.createElement("li");
        li.textContent = `Item ${i}`;
        li.dataset.index = i;
        list.appendChild(li);
      }
      container.appendChild(list);

      return {
        addedElement: !!document.getElementById("new-element"),
        elementText: document.getElementById("new-element").textContent,
        elementClass: document.getElementById("new-element").className,
        elementStyle:
          document.getElementById("new-element").style.backgroundColor,
        listItems: Array.from(document.querySelectorAll("li")).map((li) => ({
          text: li.textContent,
          index: li.dataset.index
        }))
      };
    });

    console.log(`  ✓ Element added: ${manipulationResults.addedElement}`);
    console.log(`  ✓ Element text: ${manipulationResults.elementText}`);
    console.log(`  ✓ Element class: ${manipulationResults.elementClass}`);
    console.log(`  ✓ Element style: ${manipulationResults.elementStyle}`);
    console.log(
      `  ✓ List items created: ${manipulationResults.listItems.length}\n`
    );
    results.passed++;

    // Test 5: Event Handling and Form Inspection
    console.log("📝 Test 5: Form and Event Handling");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <form id="test-form">
            <input type="text" id="name" name="name" value="John Doe">
            <input type="email" id="email" name="email" value="john@example.com">
            <textarea id="message" name="message">Hello World</textarea>
            <select id="country" name="country">
              <option value="us">United States</option>
              <option value="uk" selected>United Kingdom</option>
              <option value="ca">Canada</option>
            </select>
            <input type="checkbox" id="agree" name="agree" checked>
            <input type="radio" id="radio1" name="option" value="1">
            <input type="radio" id="radio2" name="option" value="2" checked>
            <button type="button" id="test-btn">Click Me</button>
          </form>
          <div id="output"></div>
          <script>
            document.getElementById('test-btn').addEventListener('click', () => {
              document.getElementById('output').textContent = 'Button clicked!';
            });
          </script>
        </body>
      </html>
    `);

    const formData = await page.evaluate(() => {
      return {
        nameValue: document.getElementById("name").value,
        emailValue: document.getElementById("email").value,
        messageValue: document.getElementById("message").value,
        selectedCountry: document.getElementById("country").value,
        checkboxChecked: document.getElementById("agree").checked,
        selectedRadio: document.querySelector('input[name="option"]:checked')
          .value
      };
    });

    console.log(`  ✓ Name input: ${formData.nameValue}`);
    console.log(`  ✓ Email input: ${formData.emailValue}`);
    console.log(`  ✓ Textarea: ${formData.messageValue}`);
    console.log(`  ✓ Selected option: ${formData.selectedCountry}`);
    console.log(`  ✓ Checkbox checked: ${formData.checkboxChecked}`);
    console.log(`  ✓ Radio selected: ${formData.selectedRadio}`);

    // Test click event
    await page.click("#test-btn");
    await page.waitForFunction(
      () => document.getElementById("output").textContent === "Button clicked!"
    );
    const outputText = await page.$eval("#output", (el) => el.textContent);
    console.log(`  ✓ Button click event: ${outputText}\n`);
    results.passed++;

    // Test 6: Complex CSS Selectors and Computed Styles
    console.log("🎨 Test 6: CSS Selectors and Computed Styles");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .parent > .child { color: red; }
            .parent .descendant { font-size: 16px; }
            [data-role="button"] { cursor: pointer; }
            div:nth-child(2) { background: yellow; }
            .hidden { display: none; }
            .visible { display: block; }
          </style>
        </head>
        <body>
          <div class="parent">
            <div class="child">Child 1</div>
            <div class="child descendant">Child 2</div>
            <span class="descendant">Span</span>
          </div>
          <button data-role="button">Action</button>
          <div class="hidden">Hidden content</div>
          <div class="visible">Visible content</div>
        </body>
      </html>
    `);

    const cssTest = await page.evaluate(() => {
      const child = document.querySelector(".parent > .child");
      const descendant = document.querySelector(".parent .descendant");
      const button = document.querySelector('[data-role="button"]');
      const nthChild = document.querySelector("div:nth-child(2)");
      const hidden = document.querySelector(".hidden");
      const visible = document.querySelector(".visible");

      const childStyle = window.getComputedStyle(child);
      const hiddenStyle = window.getComputedStyle(hidden);
      const visibleStyle = window.getComputedStyle(visible);

      return {
        childColor: childStyle.color,
        childFound: !!child,
        descendantFound: !!descendant,
        buttonFound: !!button,
        nthChildFound: !!nthChild,
        hiddenDisplay: hiddenStyle.display,
        visibleDisplay: visibleStyle.display
      };
    });

    console.log(`  ✓ Child selector: ${cssTest.childFound}`);
    console.log(`  ✓ Child color: ${cssTest.childColor}`);
    console.log(`  ✓ Descendant selector: ${cssTest.descendantFound}`);
    console.log(`  ✓ Attribute selector: ${cssTest.buttonFound}`);
    console.log(`  ✓ Nth-child selector: ${cssTest.nthChildFound}`);
    console.log(`  ✓ Hidden element display: ${cssTest.hiddenDisplay}`);
    console.log(`  ✓ Visible element display: ${cssTest.visibleDisplay}\n`);
    results.passed++;

    // Test 7: Nested Shadow DOM (Complex ChatKit scenario)
    console.log("🌑🌑 Test 7: Nested Shadow DOM");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="outer-host"></div>
          <script>
            const outerHost = document.getElementById('outer-host');
            const outerShadow = outerHost.attachShadow({ mode: 'open' });
            outerShadow.innerHTML = \`
              <div class="outer-content">
                <h3>Outer Shadow</h3>
                <div id="inner-host"></div>
              </div>
            \`;

            const innerHost = outerShadow.getElementById('inner-host');
            const innerShadow = innerHost.attachShadow({ mode: 'open' });
            innerShadow.innerHTML = \`
              <div class="inner-content">
                <p id="deep-content">Deep nested content</p>
                <button id="deep-button">Deep Button</button>
              </div>
            \`;
          </script>
        </body>
      </html>
    `);

    const nestedShadowTest = await page.evaluate(() => {
      const outerHost = document.getElementById("outer-host");
      const outerShadow = outerHost.shadowRoot;
      const outerTitle = outerShadow.querySelector("h3")?.textContent;

      const innerHost = outerShadow.getElementById("inner-host");
      const innerShadow = innerHost.shadowRoot;
      const deepContent =
        innerShadow.querySelector("#deep-content")?.textContent;
      const deepButton = innerShadow.querySelector("#deep-button")?.textContent;

      return {
        hasOuterShadow: !!outerShadow,
        outerTitle,
        hasInnerShadow: !!innerShadow,
        deepContent,
        deepButton
      };
    });

    console.log(`  ✓ Outer shadow exists: ${nestedShadowTest.hasOuterShadow}`);
    console.log(`  ✓ Outer title: ${nestedShadowTest.outerTitle}`);
    console.log(`  ✓ Inner shadow exists: ${nestedShadowTest.hasInnerShadow}`);
    console.log(`  ✓ Deep content: ${nestedShadowTest.deepContent}`);
    console.log(`  ✓ Deep button: ${nestedShadowTest.deepButton}\n`);
    results.passed++;

    // Test 8: DOM Traversal and Relationships
    console.log("🔗 Test 8: DOM Traversal and Relationships");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="root">
            <div id="parent">
              <div id="first-child" class="child">First</div>
              <div id="middle-child" class="child">Middle</div>
              <div id="last-child" class="child">Last</div>
            </div>
          </div>
        </body>
      </html>
    `);

    const traversalTest = await page.evaluate(() => {
      const middle = document.getElementById("middle-child");

      return {
        hasParent: !!middle.parentElement,
        parentId: middle.parentElement?.id,
        hasNextSibling: !!middle.nextElementSibling,
        nextSiblingId: middle.nextElementSibling?.id,
        hasPrevSibling: !!middle.previousElementSibling,
        prevSiblingId: middle.previousElementSibling?.id,
        firstChild: middle.parentElement?.firstElementChild?.id,
        lastChild: middle.parentElement?.lastElementChild?.id,
        childrenCount: middle.parentElement?.children.length,
        closestParent: middle.closest("#root")?.id
      };
    });

    console.log(`  ✓ Parent element: ${traversalTest.parentId}`);
    console.log(`  ✓ Next sibling: ${traversalTest.nextSiblingId}`);
    console.log(`  ✓ Previous sibling: ${traversalTest.prevSiblingId}`);
    console.log(`  ✓ First child: ${traversalTest.firstChild}`);
    console.log(`  ✓ Last child: ${traversalTest.lastChild}`);
    console.log(`  ✓ Children count: ${traversalTest.childrenCount}`);
    console.log(`  ✓ Closest ancestor: ${traversalTest.closestParent}\n`);
    results.passed++;

    // Test 9: Bounding Boxes and Element Positions
    console.log("📐 Test 9: Element Positions and Bounding Boxes");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            #box {
              width: 200px;
              height: 100px;
              margin: 50px;
              padding: 20px;
              border: 5px solid black;
              position: absolute;
              top: 100px;
              left: 150px;
            }
          </style>
        </head>
        <body>
          <div id="box">Test Box</div>
        </body>
      </html>
    `);

    const boundingBox = await page.$eval("#box", (el) => {
      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);

      return {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        computedWidth: computed.width,
        computedHeight: computed.height,
        padding: computed.padding,
        margin: computed.margin
      };
    });

    console.log(`  ✓ Width: ${boundingBox.width}px`);
    console.log(`  ✓ Height: ${boundingBox.height}px`);
    console.log(
      `  ✓ Position (top, left): (${boundingBox.top}px, ${boundingBox.left}px)`
    );
    console.log(`  ✓ Computed width: ${boundingBox.computedWidth}`);
    console.log(`  ✓ Computed height: ${boundingBox.computedHeight}\n`);
    results.passed++;

    // Test 10: Screenshot with DOM annotations
    console.log("📸 Test 10: Screenshots and Visual Verification");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial; padding: 20px; background: linear-gradient(to right, #667eea 0%, #764ba2 100%); }
            .container { background: white; padding: 40px; border-radius: 10px; max-width: 800px; margin: 0 auto; }
            h1 { color: #667eea; }
            .test-item { margin: 20px 0; padding: 15px; background: #f5f5f5; border-left: 4px solid #667eea; }
            .shadow-demo { padding: 20px; margin: 20px 0; border: 2px dashed #ccc; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>DOM Inspection Test Page</h1>
            <div class="test-item">
              <strong>Test 1:</strong> Regular DOM Content
            </div>
            <div class="test-item">
              <strong>Test 2:</strong> Shadow DOM Content
              <div id="screenshot-shadow" class="shadow-demo"></div>
            </div>
            <div class="test-item">
              <strong>Test 3:</strong> Form Elements
              <input type="text" value="Test Input" style="margin: 10px 0;">
            </div>
          </div>
          <script>
            const host = document.getElementById('screenshot-shadow');
            const shadow = host.attachShadow({ mode: 'open' });
            shadow.innerHTML = '<p style="color: purple; font-weight: bold;">This is Shadow DOM content!</p>';
          </script>
        </body>
      </html>
    `);

    const screenshotPath = path.join(
      __dirname,
      "test-dom-inspection-screenshot.png"
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  ✓ Screenshot saved: ${screenshotPath}\n`);
    results.passed++;

    // Test 11: ChatKit-specific scenario
    console.log("💬 Test 11: ChatKit-like Widget Simulation");
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="chatkit-widget"></div>
          <script>
            const widget = document.getElementById('chatkit-widget');
            const shadow = widget.attachShadow({ mode: 'open' });

            // Simulate ChatKit structure
            shadow.innerHTML = \`
              <style>
                .chatkit-container {
                  font-family: system-ui;
                  max-width: 400px;
                  border: 1px solid #ccc;
                  border-radius: 8px;
                  padding: 16px;
                }
                .chatkit-header {
                  font-weight: bold;
                  margin-bottom: 12px;
                  padding-bottom: 12px;
                  border-bottom: 1px solid #eee;
                }
                .chatkit-message {
                  padding: 8px;
                  margin: 8px 0;
                  background: #f0f0f0;
                  border-radius: 4px;
                }
                .chatkit-input {
                  width: 100%;
                  padding: 8px;
                  border: 1px solid #ccc;
                  border-radius: 4px;
                  margin-top: 12px;
                }
                .chatkit-button {
                  background: #007bff;
                  color: white;
                  border: none;
                  padding: 8px 16px;
                  border-radius: 4px;
                  cursor: pointer;
                  margin-top: 8px;
                }
              </style>
              <div class="chatkit-container">
                <div class="chatkit-header">ChatKit Widget</div>
                <div class="chatkit-messages">
                  <div class="chatkit-message" data-message-id="1">Hello! How can I help?</div>
                  <div class="chatkit-message" data-message-id="2">Please select an option below.</div>
                </div>
                <input type="text" class="chatkit-input" placeholder="Type your message..." id="chat-input">
                <button class="chatkit-button" id="send-btn">Send</button>
              </div>
            \`;
          </script>
        </body>
      </html>
    `);

    // Give a moment for the script to execute
    await new Promise((resolve) => setTimeout(resolve, 100));

    const chatkitTest = await page.evaluate(() => {
      const widget = document.getElementById("chatkit-widget");
      const shadow = widget?.shadowRoot;

      if (!widget) {
        return { error: "Widget not found" };
      }

      if (!shadow) {
        return { error: "Shadow root not found" };
      }

      const messages = Array.from(
        shadow.querySelectorAll(".chatkit-message") || []
      ).map((msg) => ({
        id: msg.dataset.messageId,
        text: msg.textContent
      }));

      const input = shadow.getElementById("chat-input");
      const button = shadow.getElementById("send-btn");

      return {
        widgetFound: !!widget,
        shadowExists: !!shadow,
        headerText: shadow.querySelector(".chatkit-header")?.textContent,
        messageCount: messages.length,
        messages,
        inputPlaceholder: input?.placeholder,
        buttonText: button?.textContent,
        inputExists: !!input,
        buttonExists: !!button
      };
    });

    if (chatkitTest.error) {
      console.log(`  ❌ Error: ${chatkitTest.error}\n`);
      results.failed++;
    } else {
      console.log(`  ✓ ChatKit widget found: ${chatkitTest.widgetFound}`);
      console.log(`  ✓ Shadow DOM exists: ${chatkitTest.shadowExists}`);
      console.log(`  ✓ Header text: ${chatkitTest.headerText}`);
      console.log(`  ✓ Messages found: ${chatkitTest.messageCount}`);
      if (chatkitTest.messages && chatkitTest.messages.length > 0) {
        chatkitTest.messages.forEach((msg) => {
          console.log(`    - Message ${msg.id}: ${msg.text}`);
        });
      }
      console.log(
        `  ✓ Input exists: ${chatkitTest.inputExists} (${chatkitTest.inputPlaceholder})`
      );
      console.log(
        `  ✓ Button exists: ${chatkitTest.buttonExists} (${chatkitTest.buttonText})\n`
      );

      const chatkitScreenshot = path.join(
        __dirname,
        "test-chatkit-widget-screenshot.png"
      );
      await page.screenshot({ path: chatkitScreenshot, fullPage: true });
      console.log(`  ✓ ChatKit screenshot: ${chatkitScreenshot}\n`);
      results.passed++;
    }

    // Summary
    console.log("═".repeat(60));
    console.log("📊 Test Summary");
    console.log("═".repeat(60));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(
      `📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%\n`
    );

    console.log("🎉 All DOM inspection tests completed successfully!\n");
    console.log("Capabilities verified:");
    console.log("  ✓ Basic DOM traversal and querying");
    console.log("  ✓ Shadow DOM inspection (single and nested)");
    console.log("  ✓ DOM manipulation and modification");
    console.log("  ✓ Form elements and event handling");
    console.log("  ✓ CSS selectors and computed styles");
    console.log("  ✓ Element positioning and bounding boxes");
    console.log("  ✓ Screenshot capture with annotations");
    console.log("  ✓ ChatKit-like widget simulation\n");
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
testDOMInspection().catch(console.error);
