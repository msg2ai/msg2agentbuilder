#!/usr/bin/env node

/**
 * Test the SMS webhook endpoint with SSE interception in Docker
 *
 * This test:
 * 1. Sends a POST request to the SMS webhook endpoint running in Docker
 * 2. Simulates a Twilio SMS webhook
 * 3. Verifies the response is captured via SSE interception
 */

const http = require("http");

console.log(
  "=========================================================================================="
);
console.log("🐳 SMS WEBHOOK TEST (Docker)");
console.log(
  "==========================================================================================\n"
);

async function testSMSWebhook() {
  const testPhone = "+15555551234";
  const testMessage = "What is the capital of France?";

  console.log("📱 Sending test SMS to Docker webhook...");
  console.log("   From:", testPhone);
  console.log("   Message:", testMessage);
  console.log("   Endpoint: http://localhost:3003/api/sms-webhook\n");

  const postData = new URLSearchParams({
    From: testPhone,
    Body: testMessage
  }).toString();

  const options = {
    hostname: "localhost",
    port: 3003,
    path: "/api/sms-webhook",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData)
    },
    timeout: 60000 // 60 second timeout
  };

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const req = http.request(options, (res) => {
      let data = "";

      console.log("📡 Response Status:", res.statusCode);
      console.log("");

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log("=".repeat(80));
        console.log("📊 RESULT");
        console.log("=".repeat(80));
        console.log("\nResponse Time:", duration, "seconds");
        console.log("Response Body:", data);
        console.log("");

        if (res.statusCode === 200) {
          console.log("✅ SUCCESS - Webhook processed the SMS");
          console.log("");
          console.log("💡 Check the Docker logs to see:");
          console.log("   1. [sse-intercept] logs showing SSE capture");
          console.log("   2. [sms-webhook] logs showing response extraction");
          console.log('   3. Capture method used (should be "sse-intercept")');
          console.log("");
          console.log(
            "Run: docker logs openai-chatkit-extraction-app-virtual-display-1 --tail 50"
          );
        } else if (res.statusCode === 429) {
          console.log("⚠️  RATE LIMITED - Too many requests");
        } else {
          console.log("❌ FAILED - Unexpected status code");
        }

        console.log("\n" + "=".repeat(80) + "\n");
        resolve();
      });
    });

    req.on("error", (error) => {
      console.error("❌ Request failed:", error.message);
      console.error("\n🔍 Troubleshooting:");
      console.error("   1. Is Docker running? Run: docker ps");
      console.error(
        "   2. Is the app accessible? Try: curl http://localhost:3003"
      );
      console.error(
        "   3. Check Docker logs: docker logs openai-chatkit-extraction-app-virtual-display-1"
      );
      reject(error);
    });

    req.on("timeout", () => {
      req.destroy();
      console.error("❌ Request timed out after 60 seconds");
      console.error(
        "\n🔍 The ChatKit response might be taking longer than expected"
      );
      console.error("   Check Docker logs for details");
      reject(new Error("Timeout"));
    });

    req.write(postData);
    req.end();
  });
}

// Run the test
testSMSWebhook()
  .then(() => {
    console.log("🎉 Test complete!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed:", error.message);
    process.exit(1);
  });
