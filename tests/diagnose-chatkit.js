// Diagnostic script to check ChatKit configuration
const fs = require("fs");
const path = require("path");

// Read .env.local file
const envPath = path.join(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};

envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const WORKFLOW_ID = envVars.NEXT_PUBLIC_WORKFLOW_ID;
const API_KEY = envVars.OPENAI_API_KEY;

async function diagnose() {
  console.log("========================================");
  console.log("ChatKit Configuration Diagnosis");
  console.log("========================================\n");

  // Step 1: Check environment variables
  console.log("✓ Step 1: Environment Variables");
  console.log("  Workflow ID:", WORKFLOW_ID);
  console.log("  API Key prefix:", API_KEY?.substring(0, 15) + "...");
  console.log(
    "  API Key type:",
    API_KEY?.startsWith("sk-proj-") ? "Project Key" : "Unknown"
  );
  console.log("");

  if (!WORKFLOW_ID || !API_KEY) {
    console.error("❌ Missing WORKFLOW_ID or API_KEY");
    process.exit(1);
  }

  // Step 2: Test session creation
  console.log("✓ Step 2: Testing Session Creation");
  try {
    const sessionResponse = await fetch(
      "https://api.openai.com/v1/chatkit/sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "OpenAI-Beta": "chatkit_beta=v1"
        },
        body: JSON.stringify({
          workflow: { id: WORKFLOW_ID },
          user: "diagnostic-user-" + Date.now(),
          chatkit_configuration: {
            file_upload: { enabled: true }
          }
        })
      }
    );

    const sessionData = await sessionResponse.json();

    console.log(
      "  Status:",
      sessionResponse.status,
      sessionResponse.statusText
    );

    if (!sessionResponse.ok) {
      console.error("  ❌ Session creation failed");
      console.error("  Error:", JSON.stringify(sessionData, null, 2));

      // Common error checks
      if (sessionData.error?.message?.includes("workflow")) {
        console.error(
          "\n  💡 LIKELY ISSUE: Workflow not found or not published"
        );
        console.error("     → Go to https://platform.openai.com/agent-builder");
        console.error('     → Find your workflow and click "Publish"');
        console.error("     → Copy the published workflow ID");
      }
      if (
        sessionData.error?.message?.includes("organization") ||
        sessionData.error?.message?.includes("project")
      ) {
        console.error(
          "\n  💡 LIKELY ISSUE: API key and workflow are in different org/project"
        );
        console.error(
          "     → Ensure API key and workflow are in the same OpenAI project"
        );
      }
      if (sessionData.error?.code === "invalid_api_key") {
        console.error("\n  💡 LIKELY ISSUE: Invalid or expired API key");
        console.error(
          "     → Generate a new API key from https://platform.openai.com/api-keys"
        );
      }

      process.exit(1);
    }

    console.log("  ✅ Session created successfully!");
    console.log("  Session ID:", sessionData.id);
    console.log(
      "  Client secret prefix:",
      sessionData.client_secret?.substring(0, 20) + "..."
    );
    console.log("  Workflow ID:", sessionData.workflow?.id);
    console.log("  User:", sessionData.user);
    console.log("");

    // Step 3: Test conversation endpoint with the client secret
    console.log("✓ Step 3: Testing Conversation Endpoint");
    const conversationResponse = await fetch(
      "https://api.openai.com/v1/chatkit/conversation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.client_secret}`,
          Accept: "text/event-stream"
        },
        body: JSON.stringify({
          type: "threads.add_user_message",
          params: {
            input: {
              content: [
                {
                  type: "input_text",
                  text: "Hello! This is a diagnostic test."
                }
              ],
              quoted_text: "",
              attachments: []
            }
          }
        })
      }
    );

    console.log(
      "  Status:",
      conversationResponse.status,
      conversationResponse.statusText
    );
    console.log(
      "  Content-Type:",
      conversationResponse.headers.get("content-type")
    );

    if (!conversationResponse.ok) {
      const errorText = await conversationResponse.text();
      console.error("  ❌ Conversation failed");
      console.error("  Response:", errorText.substring(0, 500));

      try {
        const errorData = JSON.parse(errorText);
        console.error("  Error details:", JSON.stringify(errorData, null, 2));
      } catch (e) {
        // Not JSON
      }

      process.exit(1);
    }

    // Check if we get turnstile/pow response
    const firstChunk = await conversationResponse.text();

    if (
      firstChunk.includes("turnstile") ||
      firstChunk.includes("proofofwork") ||
      firstChunk.includes("chatgpt-noauth")
    ) {
      console.error("  ❌ Received Turnstile/Proof-of-Work challenge!");
      console.error("  This means the session is not properly authenticated.");
      console.error("");
      console.error("  💡 LIKELY ISSUES:");
      console.error(
        "     1. API key doesn't have ChatKit access in this organization"
      );
      console.error(
        "     2. Workflow is in a different project than the API key"
      );
      console.error("     3. Workflow is not properly published");
      console.error("");
      console.error("  Response preview:");
      console.error("  ", firstChunk.substring(0, 300));
      process.exit(1);
    }

    console.log("  ✅ Conversation endpoint responding!");
    console.log("  Response preview:", firstChunk.substring(0, 200));
    console.log("");

    console.log("========================================");
    console.log("✅ ALL CHECKS PASSED!");
    console.log("========================================");
    console.log("");
    console.log("Your ChatKit configuration is correct.");
    console.log("If you're still having issues in the browser:");
    console.log("  1. Clear browser cache and cookies");
    console.log("  2. Restart your dev server");
    console.log("  3. Check browser console for errors");
  } catch (error) {
    console.error("\n❌ Diagnostic failed with error:", error.message);
    if (error.cause) {
      console.error("Cause:", error.cause);
    }
    process.exit(1);
  }
}

diagnose();
