# Twilio SMS Integration Guide

## Table of Contents

1. [Overview](#overview)
2. [Twilio Account Setup](#twilio-account-setup)
3. [Phone Number Configuration](#phone-number-configuration)
4. [Webhook Configuration](#webhook-configuration)
5. [Testing the Integration](#testing-the-integration)
6. [How It Works](#how-it-works)
7. [Advanced Configuration](#advanced-configuration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Msg2AgentBuilder platform integrates with Twilio to enable SMS-based conversations with OpenAI's ChatKit AI workflows. Users can send SMS messages to your Twilio phone number, and the system will process them through your AI agent and respond automatically.

### Integration Flow

```
┌──────────┐
│   User   │ sends SMS: "What's 2+2?"
└────┬─────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│  Twilio                                         │
│  - Receives SMS                                 │
│  - Validates sender                             │
│  - Triggers webhook                             │
└────┬────────────────────────────────────────────┘
     │ POST https://your-app.run.app/api/sms-webhook
     │ {
     │   From: "+1234567890",
     │   Body: "What's 2+2?",
     │   MessageSid: "SM...",
     │   ... other params
     │ }
     ▼
┌─────────────────────────────────────────────────┐
│  Msg2AgentBuilder /api/sms-webhook              │
│  1. Validate Twilio signature (security)        │
│  2. Check rate limits (10/hour)                 │
│  3. Get/create browser session                  │
│  4. Inject message into ChatKit UI              │
│  5. Wait for AI response (max 60s)              │
│  6. Send response back via Twilio               │
└────┬────────────────────────────────────────────┘
     │ POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
     │ {
     │   From: "+10987654321",
     │   To: "+1234567890",
     │   Body: "4"
     │ }
     ▼
┌─────────────────────────────────────────────────┐
│  Twilio                                         │
│  - Sends SMS to user                            │
└────┬────────────────────────────────────────────┘
     │
     ▼
┌──────────┐
│   User   │ receives SMS: "4"
└──────────┘
```

---

## Twilio Account Setup

### Step 1: Create Twilio Account

1. Visit https://www.twilio.com/
2. Click "Sign Up" or "Try Twilio Free"
3. Fill in your details:
   - Email address
   - Password
   - First name / Last name
   - Company name (optional)
4. Verify your email address
5. Complete phone verification

**Free Trial**:

- $15 trial credit
- Test with verified phone numbers only
- Twilio branding on messages

**Paid Account**:

- Remove Twilio branding
- Send to any number
- Higher rate limits

### Step 2: Get Account Credentials

1. Log in to [Twilio Console](https://console.twilio.com/)
2. Go to **Account** → **Account Info**
3. Note your **Account SID**:

```
Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 2.5: Create API Keys (Recommended)

**Why API Keys?**

- More secure than using Auth Token
- Can be rotated without changing main account credentials
- Can be restricted with specific permissions
- Better for production applications

**Create API Keys**:

1. Go to **Account** → **API keys & tokens**
2. Click **Create API key**
3. Provide a friendly name (e.g., "Msg2AgentBuilder Production")
4. Click **Create API Key**
5. **IMPORTANT**: Save both values immediately (you can't view the secret again):

```
API Key SID: SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
API Key Secret: [Your secret - save this now!]
```

**Security Note**: Keep your API Key Secret safe! Never commit it to version control or share it publicly.

### Step 3: Purchase Phone Number

**Free Trial**: Skip to verification (use trial number)

**Paid Account**:

1. Go to **Phone Numbers** → **Buy a Number**
2. Select your country
3. Filter by capabilities:
   - ☑ SMS
   - ☐ Voice (optional)
   - ☐ MMS (optional)
4. Choose a number
5. Click **Buy**

**Number Format**: Always use E.164 format

```
Correct:   +12025551234
Incorrect: (202) 555-1234
Incorrect: 202-555-1234
```

### Step 4: Configure Environment Variables

Add to your `.env.local`:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your_api_key_secret_here
TWILIO_PHONE_NUMBER=+12025551234
```

**Important - Why You Need Both**:

- **Auth Token** - Used ONLY for validating incoming webhook signatures from Twilio
- **API Keys** - Used for all outgoing API calls (sending SMS messages)

This separation improves security because:

1. API Keys can be rotated without changing webhook validation
2. API Keys can have restricted permissions
3. If API Keys are compromised, webhooks still work
4. Better audit trail for API usage

**Note**: If you haven't created API Keys yet, go back to Step 2.5 above.

---

## Phone Number Configuration

### Step 1: Access Phone Number Settings

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your phone number

### Step 2: Configure Messaging

Scroll to **Messaging Configuration** section:

#### A MESSAGE COMES IN

**Configure As**: Webhook

**Webhook URL**:

```
https://your-cloud-run-url.run.app/api/sms-webhook
```

**HTTP Method**: `POST`

**Fallback URL**: (Optional)

```
https://your-cloud-run-url.run.app/api/sms-webhook-fallback
```

**Status Callback URL**: (Optional, for delivery reports)

```
https://your-cloud-run-url.run.app/api/sms-status
```

### Step 3: Save Configuration

Click **Save** at the bottom of the page.

### Getting Your Cloud Run URL

If you deployed to Google Cloud Run:

```bash
gcloud run services describe chatkit-app \
  --region us-central1 \
  --format='value(status.url)'
```

Example output:

```
https://chatkit-app-abc123-uc.a.run.app
```

---

## Webhook Configuration

### Understanding Webhook Parameters

When Twilio sends a webhook request, it includes:

| Parameter     | Description                             | Example                              |
| ------------- | --------------------------------------- | ------------------------------------ |
| `MessageSid`  | Unique message identifier               | `SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `AccountSid`  | Your Twilio account SID                 | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `From`        | Sender's phone number (E.164)           | `+12025551234`                       |
| `To`          | Your Twilio phone number                | `+10987654321`                       |
| `Body`        | SMS message text                        | `What is the capital of France?`     |
| `NumMedia`    | Number of media files (0 for text-only) | `0`                                  |
| `FromCity`    | Sender's city (if available)            | `Washington`                         |
| `FromState`   | Sender's state                          | `DC`                                 |
| `FromCountry` | Sender's country                        | `US`                                 |

### Webhook Security (Optional Enhancement)

For production deployments, you can enhance security by implementing Twilio webhook signature validation. This verifies that incoming requests are genuinely from Twilio and not from malicious actors.

**Why Signature Validation?**

- Prevents unauthorized parties from triggering your webhook
- Ensures request integrity (message content hasn't been tampered with)
- Required for PCI compliance in some use cases

**How Twilio Signature Validation Works:**

1. Twilio signs each webhook request with HMAC-SHA1 using your Auth Token
2. The signature is sent in the `X-Twilio-Signature` header
3. Your application validates the signature by:
   - Computing the expected signature using the same Auth Token
   - Comparing it with the received signature
4. Requests with invalid signatures are rejected

**Implementation Example:**

```typescript
import twilio from "twilio";

const twilioSignature = request.headers.get("X-Twilio-Signature");
const webhookUrl = `${process.env.APP_URL}/api/sms-webhook`;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Parse request body
const formData = await request.formData();
const requestBody = Object.fromEntries(formData);

// Validate signature
const isValid = twilio.validateRequest(
  authToken,
  twilioSignature,
  webhookUrl,
  requestBody
);

if (!isValid) {
  return new Response("Forbidden", { status: 403 });
}
```

**Important Notes:**

- Signature validation uses your **Auth Token** (not API Key)
- The webhook URL used for validation must exactly match the configured URL in Twilio
- For ngrok/tunneling during development, signature validation may fail due to URL mismatches

**References:**

- [Twilio Security Best Practices](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Twilio Signature Validation](https://www.twilio.com/docs/usage/security#validating-requests)

**Current Implementation:**

This starter template prioritizes rapid development and assumes deployment in a trusted environment. For public-facing production deployments, we recommend adding signature validation as shown above.

---

## Testing the Integration

### Test 1: Health Check

Verify your webhook endpoint is accessible:

```bash
curl https://your-app.run.app/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-23T12:00:00.000Z"
}
```

### Test 2: Manual Webhook Test

Use Twilio Console to send test SMS:

1. Go to **Develop** → **Messaging** → **Try it Out** → **Send an SMS**
2. From: Your Twilio number
3. To: Your verified phone number (trial) or any number (paid)
4. Message: "Hello from Twilio!"
5. Click **Make Request**

### Test 3: Real SMS Test

Send an actual SMS from your phone:

```
To: [Your Twilio phone number]
Message: What is 2+2?
```

**Expected Flow**:

1. You send SMS
2. Within 5-30 seconds, you receive AI response
3. Check Cloud Run logs:

```bash
gcloud run services logs read chatkit-app \
  --region us-central1 \
  --limit 50
```

Look for:

```
[sms-webhook] Incoming SMS from +1234567890: "What is 2+2?"
[browserless] Creating new browser session for +1234567890
[ChatKitPanel] ✅ SMS successfully injected into ChatKit
[SSE Intercept] 📝 Response captured: "4"
[send-sms] ✅ SMS sent successfully to +1234567890
```

### Test 4: Conversation Test

Test multi-turn conversations:

```
You: What is the capital of France?
AI: The capital of France is Paris.

You: How many people live there?
AI: Paris has approximately 2.2 million residents in the city proper...

You: Thanks!
AI: You're welcome! Feel free to ask if you have more questions.
```

**Browser session reuse**: Second message should respond faster (reuses existing Chromium instance).

### Test 5: Error Handling

Test rate limiting:

```bash
# Send 11 messages rapidly from same number
# 11th should be rejected with:
# "Rate limit exceeded. Please try again later."
```

Test invalid input:

```bash
# Send extremely long message (>1600 chars)
# Should receive:
# "Message too long. Please keep messages under 1600 characters."
```

---

## How It Works

### Detailed Message Flow

#### 1. SMS Reception (Twilio → Msg2AgentBuilder)

**Trigger**: User sends SMS to your Twilio number

**Twilio Action**:

```
POST /api/sms-webhook HTTP/1.1
Host: your-app.run.app
Content-Type: application/x-www-form-urlencoded
X-Twilio-Signature: bLAqQrOuz5...

From=%2B12025551234&
To=%2B10987654321&
Body=What+is+the+capital+of+France%3F&
MessageSid=SMxxxxxx...
```

#### 2. Webhook Processing (Msg2AgentBuilder)

**File**: `app/api/sms-webhook/route.ts`

**Steps**:

```typescript
// 1. Parse request
const from = formData.get('From');
const body = formData.get('Body');

// 2. Validate signature
if (!validateRequest(...)) {
  return Response.json({ error: 'Invalid signature' }, { status: 403 });
}

// 3. Rate limiting
const key = `sms:${from}`;
const count = await redis.get(key);
if (count >= 10) {
  return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
}

// 4. Get or create browser session
let session = browserSessions.get(from);
if (!session) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    env: { DISPLAY: ':99' }
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');

  session = { browser, page, from, lastActivity: Date.now() };
  browserSessions.set(from, session);
}

// 5. Inject SMS into ChatKit
await session.page.evaluate((message, phone) => {
  window.dispatchEvent(new CustomEvent('incoming-sms', {
    detail: { from: phone, message }
  }));
}, body, from);

// 6. Wait for response (SSE interception)
const response = await waitForResponse(session, 60000);

// 7. Send SMS response
await sendSMS(from, response);

return Response.json({ status: 'success' });
```

#### 3. ChatKit Processing

**File**: `components/ChatKitPanel.tsx`

**Event Handler**:

```typescript
useEffect(() => {
  if (!chatkit.control) return;

  const handleIncomingSms = async (event) => {
    const { from, message } = event.detail;

    console.log("[ChatKitPanel] Incoming SMS from:", from);
    setDisplayPhoneNumber(from);

    await chatkit.sendUserMessage({ text: message });

    console.log("[ChatKitPanel] ✅ SMS successfully injected");
  };

  window.addEventListener("incoming-sms", handleIncomingSms);

  return () => {
    window.removeEventListener("incoming-sms", handleIncomingSms);
  };
}, [chatkit.control]);
```

#### 4. AI Processing (OpenAI)

**ChatKit SDK Flow**:

1. `chatkit.sendUserMessage()` called
2. ChatKit creates message in UI
3. ChatKit SDK sends to OpenAI API:
   ```
   POST https://api.openai.com/v1/chatkit/conversation
   ```
4. OpenAI routes to Agent Builder workflow
5. AI model generates response
6. Response streamed back via SSE

#### 5. Response Capture (SSE Interception)

**File**: `app/api/sms-webhook/route.ts`

**Puppeteer Response Interceptor**:

```typescript
page.on("response", async (response) => {
  const url = response.url();

  if (url.includes("api.openai.com") && url.includes("chatkit/conversation")) {
    console.log("[SSE Intercept] ChatKit conversation detected");

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.substring(6));

        if (data.message?.content) {
          const textContent = data.message.content
            .filter((item) => item.type === "output_text")
            .map((item) => item.text)
            .join("");

          if (textContent) {
            session.responseText = textContent;
            console.log(
              "[SSE Intercept] Response captured:",
              textContent.length,
              "chars"
            );
          }
        }
      }
    }
  }
});
```

#### 6. SMS Response (Msg2AgentBuilder → Twilio)

**File**: `app/api/send-sms/route.ts`

**Twilio API Call**:

```typescript
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const client = twilio(apiKeySid, apiKeySecret, { accountSid });

const message = await client.messages.create({
  from: process.env.TWILIO_PHONE_NUMBER,
  to: recipientNumber,
  body: messageText
});

console.log("[send-sms] ✅ SMS sent, SID:", message.sid);
```

#### 7. SMS Delivery (Twilio → User)

Twilio handles final delivery:

- Routes to user's carrier
- Delivery typically takes 1-3 seconds
- Optional delivery receipts via status callback

---

## Advanced Configuration

### Custom Timeout Configuration

Increase webhook timeout for complex AI workflows:

**Twilio Console**:

1. Phone Numbers → [Your Number]
2. Messaging Configuration
3. Set timeout to 60 seconds (max)

**Cloud Run**:

```bash
gcloud run services update chatkit-app \
  --timeout 300 \  # 5 minutes
  --region us-central1
```

### Rate Limiting Configuration

**File**: `app/api/sms-webhook/route.ts`

Adjust rate limits:

```typescript
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10; // 10 messages per hour

// To change: modify these constants
const RATE_LIMIT_MAX = 20; // 20 messages per hour
```

### Multiple Twilio Numbers

Support multiple phone numbers for different use cases:

**.env.local**:

```bash
TWILIO_PHONE_NUMBER_SUPPORT=+12025551111
TWILIO_PHONE_NUMBER_SALES=+12025552222
TWILIO_PHONE_NUMBER_GENERAL=+12025553333
```

**Route based on "To" number**:

```typescript
const toNumber = formData.get("To");

if (toNumber === process.env.TWILIO_PHONE_NUMBER_SUPPORT) {
  // Route to support workflow
  workflowId = "wf_support_workflow_id";
} else if (toNumber === process.env.TWILIO_PHONE_NUMBER_SALES) {
  // Route to sales workflow
  workflowId = "wf_sales_workflow_id";
}
```

### Custom Greeting Messages

Send auto-reply for first-time users:

```typescript
const isNewUser = !browserSessions.has(from);

if (isNewUser) {
  await sendSMS(
    from,
    "Welcome to Msg2AgentBuilder! I'm an AI assistant. Ask me anything!"
  );
}
```

### Conversation Persistence

Store conversation history in database:

```typescript
// After receiving SMS
await db.messages.create({
  phone: from,
  direction: "inbound",
  content: body,
  timestamp: new Date()
});

// After sending response
await db.messages.create({
  phone: from,
  direction: "outbound",
  content: response,
  timestamp: new Date()
});
```

---

## Troubleshooting

### Issue: "Webhook returned status 500"

**Twilio Error**:

```
Error - 11200
HTTP retrieval failure
```

**Diagnosis**:

```bash
gcloud run services logs read chatkit-app --limit 50
```

**Common Causes**:

- Missing environment variables
- ChatKit initialization failure
- Browser launch timeout

**Solution**:

1. Verify all env vars are set in Cloud Run
2. Check OpenAI API key is valid
3. Increase timeout: `--timeout 300`

### Issue: "No response received"

**Symptoms**: SMS never arrives, no error

**Diagnosis**:

1. Check Twilio logs:
   - Console → Monitor → Logs → Messaging
   - Look for your phone number
   - Check status: "delivered", "failed", etc.

2. Check Cloud Run logs:
   ```bash
   gcloud run services logs read chatkit-app \
     --region us-central1 \
     --limit 100 | grep "sms-webhook"
   ```

**Common Causes**:

- Webhook URL incorrect
- Signature validation failing
- Rate limit exceeded

**Solution**:

1. Verify webhook URL in Twilio Console
2. Test webhook directly:
   ```bash
   curl -X POST https://your-app.run.app/api/sms-webhook \
     -d "From=+1234567890&Body=test"
   ```
3. Check rate limit (wait 1 hour and retry)

### Issue: "Response timeout"

**Symptoms**: Error after 60 seconds

**Logs**:

```
[sms-webhook] ❌ Timeout waiting for ChatKit response
```

**Causes**:

- AI model slow to respond
- ChatKit session not initialized
- Browser crashed

**Solution**:

1. **Check ChatKit initialization**:

   ```
   [ChatKitPanel] ✅ ChatKit control initialized
   ```

   If missing, ChatKit failed to load.

2. **Increase timeout** (code):

   ```typescript
   const response = await waitForResponse(session, 120000); // 2 minutes
   ```

3. **Check OpenAI API status**: https://status.openai.com/

### Issue: "Invalid signature"

**Error**: 403 Forbidden

**Cause**: Signature validation failing

**Diagnosis**:

1. Verify `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET` are correct
2. Check `APP_URL` environment variable matches actual URL

**Solution**:

```bash
# Set correct APP_URL
gcloud run services update chatkit-app \
  --set-env-vars "APP_URL=https://chatkit-app-abc123-uc.a.run.app" \
  --region us-central1
```

### Issue: "Rate limit exceeded"

**Error**: 429 Too Many Requests

**Message**: "Rate limit exceeded. Please try again later."

**Cause**: More than 10 SMS per hour from same number

**Solution**:

1. **Wait 1 hour** for rate limit to reset
2. **Increase limit** (modify code):
   ```typescript
   const RATE_LIMIT_MAX = 20; // Increase to 20
   ```
3. **Implement paid tier** with higher limits

### Issue: "Message too long"

**Error**: SMS truncated or rejected

**Cause**: SMS limit is 1600 characters

**Solution**:

1. **Automatic splitting** (code):

   ```typescript
   function splitMessage(text, maxLength = 1600) {
     const chunks = [];
     for (let i = 0; i < text.length; i += maxLength) {
       chunks.push(text.slice(i, i + maxLength));
     }
     return chunks;
   }

   const chunks = splitMessage(response);
   for (const chunk of chunks) {
     await sendSMS(from, chunk);
   }
   ```

2. **Summarize responses** in Agent Builder workflow

### Issue: "Cold start too slow"

**Symptoms**: First SMS takes 30-60 seconds

**Cause**: Cloud Run cold start + browser launch

**Solutions**:

1. **Keep instance warm** (costs more):

   ```bash
   gcloud run services update chatkit-app \
     --min-instances 1 \
     --region us-central1
   ```

2. **Async processing**:
   - Return 200 OK immediately
   - Process in background
   - Send SMS when ready (no waiting)

3. **Optimize browser launch**:
   - Pre-built browser image
   - Faster startup args

---

## Best Practices

### 1. Security

- ✅ Always validate Twilio signature
- ✅ Use HTTPS for webhook URL
- ✅ Never log Auth Tokens
- ✅ Rotate credentials regularly
- ✅ Implement rate limiting

### 2. User Experience

- ✅ Respond within 10 seconds when possible
- ✅ Send confirmation message for slow requests
- ✅ Handle errors gracefully (friendly error messages)
- ✅ Support conversation context (reuse sessions)
- ✅ Provide help command ("Type HELP for assistance")

### 3. Cost Optimization

- ✅ Set reasonable rate limits
- ✅ Use Cloud Run min-instances=0 (scale to zero)
- ✅ Implement browser session timeout (30 min)
- ✅ Clean up inactive sessions
- ✅ Monitor usage and set budget alerts

### 4. Monitoring

- ✅ Log all SMS events
- ✅ Set up error alerts
- ✅ Track response times
- ✅ Monitor success/failure rates
- ✅ Review Twilio usage reports

---

## Additional Resources

### Twilio Documentation

- [Twilio SMS Quickstart](https://www.twilio.com/docs/sms/quickstart)
- [Webhook Configuration](https://www.twilio.com/docs/usage/webhooks)
- [Message Status Callbacks](https://www.twilio.com/docs/sms/tutorials/how-to-confirm-delivery-node-js)

### OpenAI Documentation

- [ChatKit Documentation](https://platform.openai.com/docs/chatkit)
- [Agent Builder](https://platform.openai.com/docs/agent-builder)

### Msg2AgentBuilder Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Main README](./README.md)

---

## Support

For issues or questions:

- GitHub Issues: https://github.com/RethinkLedgers/msg2agentbuilder/issues
- Twilio Support: https://support.twilio.com/
- OpenAI Support: https://help.openai.com/

---

**Integration Complete!** 📱

Your Twilio SMS integration is now configured and ready to handle AI-powered conversations.
