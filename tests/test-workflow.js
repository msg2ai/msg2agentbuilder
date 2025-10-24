// Test script to verify workflow and session creation
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

async function testWorkflow() {
  console.log("========================================");
  console.log("Testing ChatKit Workflow Configuration");
  console.log("========================================\n");

  console.log("Workflow ID:", WORKFLOW_ID);
  console.log("API Key present:", !!API_KEY);
  console.log("API Key prefix:", API_KEY?.substring(0, 10) + "...\n");

  if (!WORKFLOW_ID || !API_KEY) {
    console.error("ERROR: Missing WORKFLOW_ID or API_KEY");
    process.exit(1);
  }

  try {
    console.log("Step 1: Creating session...");
    const sessionResponse = await fetch(
      "https://api.openai.com/v1/chatkit/sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "OpenAI-Beta": "chatkit_beta=v1",
        },
        body: JSON.stringify({
          workflow: { id: WORKFLOW_ID },
          user: "test-user-" + Date.now(),
          chatkit_configuration: {
            file_upload: {
              enabled: true,
            },
          },
        }),
      }
    );

    console.log("Session Response Status:", sessionResponse.status);
    console.log("Session Response Status Text:", sessionResponse.statusText);

    const sessionData = await sessionResponse.json();
    console.log("Session Response:", JSON.stringify(sessionData, null, 2));

    if (!sessionResponse.ok) {
      console.error("\n❌ Failed to create session");
      console.error("Error details:", sessionData);
      process.exit(1);
    }

    if (!sessionData.client_secret) {
      console.error("\n❌ No client_secret in response");
      process.exit(1);
    }

    console.log("\n✅ Session created successfully");
    console.log(
      "Client secret received:",
      sessionData.client_secret.substring(0, 20) + "..."
    );

    // Step 2: Test sending a message
    console.log("\n\nStep 2: Testing message send...");
    const messageResponse = await fetch(
      "https://api.openai.com/v1/chatkit/conversation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.client_secret}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          type: "threads.add_user_message",
          params: {
            input: {
              content: [
                { type: "input_text", text: "Hello, can you hear me?" },
              ],
              quoted_text: "",
              attachments: [],
            },
          },
        }),
      }
    );

    console.log("Message Response Status:", messageResponse.status);
    console.log("Message Response Status Text:", messageResponse.statusText);
    console.log(
      "Message Response Headers:",
      Object.fromEntries(messageResponse.headers.entries())
    );

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error("\n❌ Failed to send message");
      console.error("Error response:", errorText);
      process.exit(1);
    }

    // Read the streaming response
    console.log("\n✅ Message sent successfully");
    console.log("Streaming response:");
    console.log("-------------------");

    const reader = messageResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.substring(6);
          if (data === "[DONE]") {
            console.log("\n[DONE]");
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.log("Raw data:", data);
          }
        }
      }
    }

    console.log("\n\n========================================");
    console.log("✅ All tests passed!");
    console.log("========================================");
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    console.error("Error details:", error.message);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

testWorkflow();
