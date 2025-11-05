/**
 * ChatKit API Direct Test
 *
 * This script tests the ChatKit API directly to diagnose configuration issues.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WORKFLOW_ID = process.env.NEXT_PUBLIC_WORKFLOW_ID;
const DOMAIN_KEY = process.env.NEXT_PUBLIC_CHATKIT_DOMAIN_KEY;

console.log("=".repeat(60));
console.log("  CHATKIT API DIRECT TEST");
console.log("=".repeat(60));
console.log("");

// Check environment variables
console.log("📋 Step 1: Environment Variables Check");
console.log(
  `   OPENAI_API_KEY: ${OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 20)}...` : "MISSING"}`
);
console.log(`   WORKFLOW_ID: ${WORKFLOW_ID || "MISSING"}`);
console.log(
  `   DOMAIN_KEY: ${DOMAIN_KEY ? `${DOMAIN_KEY.substring(0, 20)}...` : "MISSING"}`
);
console.log("");

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is required!");
  process.exit(1);
}

if (!WORKFLOW_ID) {
  console.error("❌ WORKFLOW_ID is required!");
  process.exit(1);
}

async function testChatKitAPI() {
  try {
    // Test 1: Create session
    console.log("📋 Step 2: Testing Session Creation");
    const url = "https://api.openai.com/v1/chatkit/sessions";

    const payload = {
      workflow: { id: WORKFLOW_ID },
      user: "test-user-" + Date.now(),
      chatkit_configuration: {
        file_upload: {
          enabled: false
        }
      }
    };

    console.log("   URL:", url);
    console.log("   Payload:", JSON.stringify(payload, null, 2));
    console.log("   Sending request...");
    console.log("");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "chatkit_beta=v1"
      },
      body: JSON.stringify(payload)
    });

    console.log("📋 Step 3: Response Analysis");
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    console.log("");

    const responseText = await response.text();

    if (response.ok) {
      console.log("✅ SUCCESS! Session created");
      try {
        const data = JSON.parse(responseText);
        console.log("   Response data:", JSON.stringify(data, null, 2));

        if (data.client_secret) {
          console.log("");
          console.log("🎉 ChatKit API is working correctly!");
          console.log(
            "   Client secret received:",
            data.client_secret.substring(0, 20) + "..."
          );
        }
      } catch (e) {
        console.log("   Raw response:", responseText);
      }
    } else {
      console.log("❌ ERROR: Request failed");
      console.log("   Status:", response.status);
      console.log("   Response:", responseText);
      console.log("");

      // Parse error details
      try {
        const errorData = JSON.parse(responseText);
        console.log("   Error details:", JSON.stringify(errorData, null, 2));

        // Provide helpful diagnostics
        console.log("");
        console.log("🔍 Diagnostic Information:");

        if (response.status === 401) {
          console.log("   ❌ Authentication failed (401)");
          console.log("   Possible causes:");
          console.log("      - Invalid API key");
          console.log("      - API key doesn't have ChatKit access");
          console.log("      - API key expired");
          console.log("");
          console.log("   Solutions:");
          console.log("      1. Verify your API key in OpenAI dashboard");
          console.log("      2. Check if ChatKit is enabled for your account");
          console.log("      3. Generate a new API key");
        } else if (response.status === 403) {
          console.log("   ❌ Forbidden (403)");
          console.log("   Possible causes:");
          console.log("      - Workflow ID doesn't belong to this API key");
          console.log("      - ChatKit not enabled for your organization");
          console.log("      - Domain restrictions");
        } else if (response.status === 404) {
          console.log("   ❌ Not Found (404)");
          console.log("   Possible causes:");
          console.log("      - Invalid workflow ID");
          console.log("      - Workflow was deleted");
          console.log("      - Wrong API endpoint");
        } else if (response.status === 422) {
          console.log("   ❌ Validation Error (422)");
          console.log("   Possible causes:");
          console.log("      - Invalid request payload");
          console.log("      - Workflow not properly configured");
        }
      } catch (e) {
        console.log("   Could not parse error response");
      }
    }
  } catch (error) {
    console.error("");
    console.error("❌ FATAL ERROR:", error.message);
    console.error("   This typically indicates:");
    console.error("      - Network connectivity issues");
    console.error("      - DNS resolution problems");
    console.error("      - Firewall blocking the request");
    console.error("");
    console.error("   Stack trace:", error.stack);
  }

  console.log("");
  console.log("=".repeat(60));
}

// Test 2: Verify Docker can reach external APIs
async function testNetworkConnectivity() {
  console.log("📋 Step 4: Network Connectivity Test");
  try {
    const testResponse = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`
      }
    });

    console.log(
      `   OpenAI API reachable: ${testResponse.ok ? "✅ YES" : "❌ NO"}`
    );
    console.log(`   Status: ${testResponse.status}`);
  } catch (error) {
    console.log(`   ❌ Cannot reach OpenAI API: ${error.message}`);
  }
  console.log("");
}

// Run tests
(async () => {
  await testChatKitAPI();
  await testNetworkConnectivity();
})();
