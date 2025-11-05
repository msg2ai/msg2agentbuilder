// Check if we can fetch workflow configuration via API
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};

envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const API_KEY = envVars.OPENAI_API_KEY;
const WORKFLOW_ID = envVars.NEXT_PUBLIC_WORKFLOW_ID;

async function checkWorkflowAPI() {
  console.log("Checking if we can fetch workflow configuration...\n");

  // Try to fetch workflow details
  const endpoints = [
    `/v1/chatkit/workflows/${WORKFLOW_ID}`,
    `/v1/workflows/${WORKFLOW_ID}`,
    `/v1/beta/workflows/${WORKFLOW_ID}`
  ];

  for (const endpoint of endpoints) {
    const url = `https://api.openai.com${endpoint}`;
    console.log(`Trying: ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "OpenAI-Beta": "chatkit_beta=v1"
      }
    });

    console.log(`Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log("SUCCESS! Workflow data:");
      console.log(JSON.stringify(data, null, 2));
      return;
    } else {
      const error = await response.text();
      console.log(`Error: ${error.substring(0, 100)}`);
    }
    console.log("");
  }

  console.log("No workflow fetch API found.");
}

checkWorkflowAPI().catch(console.error);
