const puppeteer = require("puppeteer");

async function captureVirtualDisplayScreenshot() {
  console.log("🚀 Launching browser in virtual display...");

  const browser = await puppeteer.launch({
    headless: false, // Required for virtual display
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium"
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log("📄 Loading application...");
    await page.goto("http://localhost:3000", {
      waitUntil: "networkidle0",
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    const screenshotPath = "/app/virtual-display-screenshot.png";
    console.log(`📸 Taking screenshot: ${screenshotPath}`);

    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    console.log("✅ Screenshot saved successfully!");
    console.log(`   File: ${screenshotPath}`);

    // Get file size
    const fs = require("fs");
    const stats = fs.statSync(screenshotPath);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await browser.close();
    console.log("🔒 Browser closed");
  }
}

captureVirtualDisplayScreenshot().catch(console.error);
