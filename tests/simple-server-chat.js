#!/usr/bin/env node

// Simple one-off server-side chat - the RIGHT way
// Usage: node simple-server-chat.js "Your message here"

const fs = require("fs");
const path = require("path");

// Read .env.local
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
const message = process.argv[2] || "Hello!";

async function sendMessage() {
  console.log("Sending message:", message);
  console.log("");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Fast and cheap
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error:", data);
    process.exit(1);
  }

  console.log("Response:");
  console.log("--------");
  console.log(data.choices[0].message.content);
  console.log("");
  console.log("Tokens used:", data.usage.total_tokens);
  console.log("Cost: ~$" + (data.usage.total_tokens * 0.000015).toFixed(4));
}

sendMessage().catch(console.error);
