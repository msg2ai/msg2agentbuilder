# Msg2AgentBuilder

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![NextJS](https://img.shields.io/badge/Built_with-NextJS-blue)
![OpenAI API](https://img.shields.io/badge/Powered_by-OpenAI_API-orange)
![Docker](https://img.shields.io/badge/Docker-VNC_Support-brightgreen)

## What is Msg2AgentBuilder?

Msg2AgentBuilder bridges SMS messaging with AI-powered conversations by connecting **Twilio** (for SMS reception and sending) with **OpenAI's Agent Builder** (for intelligent responses). Users can text your Twilio phone number and receive intelligent, context-aware responses powered by custom AI workflows you create in OpenAI's Agent Builder.

**OpenAI Agent Builder** is a visual workflow designer that lets you create custom AI agents with specific instructions, knowledge bases, and capabilities—without writing code. Each workflow has a unique Workflow ID that Msg2AgentBuilder uses to route conversations to the right AI agent.

**Twilio** is a cloud communications platform that provides the SMS infrastructure. It receives incoming text messages and triggers webhooks to your application, then sends AI-generated responses back to users.

**Key Features:**

- **SMS-to-AI Bridge**: Connect any Twilio phone number to any OpenAI Agent Builder workflow
- **Visual Debugging**: Watch browser automation in real-time with VNC support
- **Multi-Instance Deployment**: Scale to handle concurrent SMS conversations
- **Production-Ready**: Deploy to Google Cloud Run with auto-scaling
- **Developer-Friendly**: Includes comprehensive testing suite and documentation

## Features

- **ChatKit Integration**: Full-featured web component with theming controls
## Quick Start Guide

### For Production Deployment to Google Cloud Run (Recommended)

**Time Estimate:** 15-20 minutes (first deployment)

#### Prerequisites
- Google Cloud account with billing enabled
- OpenAI API key and workflow ID
- Twilio account (for SMS functionality)

#### Step 1: Authenticate with Google Cloud (2 minutes)
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

**Common Issue:** If you see "problem refreshing your current auth tokens":
```bash
# Solution: Re-authenticate
gcloud auth login
```

#### Step 2: Set Environment Variables (3 minutes)
```bash
export OPENAI_API_KEY="sk-proj-xxxxx"
export NEXT_PUBLIC_WORKFLOW_ID="wf_xxxxx"
export NEXT_PUBLIC_CHATKIT_DOMAIN_KEY="domain_pk_xxxxx"
export TWILIO_ACCOUNT_SID="ACxxxxx"
export TWILIO_API_KEY_SID="SKxxxxx"
export TWILIO_API_KEY_SECRET="xxxxx"
export TWILIO_PHONE_NUMBER="+1234567890"
export GCP_PROJECT_ID="your-project-id"
```

#### Step 3: Build Docker Image (8-12 minutes)
```bash
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_WORKFLOW_ID="$NEXT_PUBLIC_WORKFLOW_ID" \
  --build-arg NEXT_PUBLIC_CHATKIT_DOMAIN_KEY="$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY" \
  -t gcr.io/$GCP_PROJECT_ID/chatkit-app:latest \
  -f Dockerfile .
```

**Note:** Use `Dockerfile` for production, `Dockerfile.virtual-display` only for local VNC debugging.

#### Step 4: Push to Google Container Registry (3-5 minutes)
```bash
docker push gcr.io/$GCP_PROJECT_ID/chatkit-app:latest
```

#### Step 5: Deploy to Cloud Run (1-2 minutes)
```bash
gcloud run deploy chatkit-app \
  --image gcr.io/$GCP_PROJECT_ID/chatkit-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --port 8080 \
  --set-env-vars "OPENAI_API_KEY=$OPENAI_API_KEY,TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID,TWILIO_API_KEY_SID=$TWILIO_API_KEY_SID,TWILIO_API_KEY_SECRET=$TWILIO_API_KEY_SECRET,TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER"
```

#### Step 6: Configure Twilio Webhook (2 minutes)
```bash
# Get your deployed URL
gcloud run services describe chatkit-app --region us-central1 --format='value(status.url)'
```

Example output:
```
https://chatkit-app-95149419358.us-central1.run.app
```

Go to [Twilio Console](https://console.twilio.com/) and set:
- **Webhook URL:** `https://YOUR-SERVICE-URL.run.app/api/sms-webhook`
- **HTTP Method:** POST

#### Verify Deployment
```bash
# Test health endpoint
curl https://YOUR-SERVICE-URL.run.app/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-24T...","service":"msg2agentbuilder"}
```

### For Local Development

**Time Estimate:** 5-10 minutes

```bash
# Install dependencies (3-5 minutes)
npm install

# Create .env.local
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

Access at: **http://localhost:3000**

---

## Understanding Dockerfiles

- **Dockerfile** - Production deployment (no VNC, optimized for Cloud Run)
- **Dockerfile.virtual-display** - Local debugging with VNC server (port 5900)

Use `Dockerfile` unless you need to visually debug browser automation locally.

- **SMS Integration**: Twilio webhook support for SMS-to-ChatKit conversations
- **Virtual Display**: Xvfb + VNC support for browser automation with visual debugging
- **Multi-VNC Architecture**: Run multiple isolated VNC instances for concurrent users
- **Cloud Run Ready**: Deploy to Google Cloud Run with virtual display support
- **Browserless Mode**: Non-headless browser automation with screenshot capabilities

## What You Get

### Core Application

- Next.js app with `<openai-chatkit>` web component and theming controls
- API endpoint for creating a session at [`app/api/create-session/route.ts`](app/api/create-session/route.ts)
- SMS webhook endpoint at [`app/api/sms-webhook/route.ts`](app/api/sms-webhook/route.ts)
- Config file for starter prompts, theme, placeholder text, and greeting message

### Virtual Display & VNC

- Docker Compose configurations for single and multi-VNC deployments
- Xvfb (X Virtual Frame Buffer) for headless display
- x11vnc server for remote VNC access to running browsers
- Fluxbox window manager for VNC desktop environment

### Deployment Options

- Local development with hot reload
- Docker with virtual display and VNC access
- Multi-VNC setup (4 concurrent instances)
- Google Cloud Run deployment scripts

### Documentation & Tests

- Comprehensive testing suite in [`tests/`](tests/)
- Deployment guides in [`docs/`](docs/)
- Screenshot examples in [`screenshots/`](screenshots/)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create your environment file

Copy the example file and fill in the required values:

```bash
cp .env.example .env.local
```

You can get your workflow id from the [Agent Builder](https://platform.openai.com/agent-builder) interface, after clicking "Publish":

<img src="./public/docs/workflow.jpg" width=500 />

You can get your OpenAI API key from the [OpenAI API Keys](https://platform.openai.com/api-keys) page.

### 3. Configure ChatKit credentials

Update `.env.local` with the variables that match your setup.

- `OPENAI_API_KEY` — This must be an API key created **within the same org & project as your Agent Builder**. If you already have a different `OPENAI_API_KEY` env variable set in your terminal session, that one will take precedence over the key in `.env.local` one (this is how a Next.js app works). So, **please run `unset OPENAI_API_KEY` (`set OPENAI_API_KEY=` for Windows OS) beforehand**.
- `NEXT_PUBLIC_WORKFLOW_ID` — This is the ID of the workflow you created in [Agent Builder](https://platform.openai.com/agent-builder), which starts with `wf_...`
- (optional) `CHATKIT_API_BASE` - This is a customizable base URL for the ChatKit API endpoint

> Note: if your workflow is using a model requiring organization verification, such as GPT-5, make sure you verify your organization first. Visit your [organization settings](https://platform.openai.com/settings/organization/general) and click on "Verify Organization".

### 4. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000` and start chatting. Use the prompts on the start screen to verify your workflow connection, then customize the UI or prompt list in [`lib/config.ts`](lib/config.ts) and [`components/ChatKitPanel.tsx`](components/ChatKitPanel.tsx).

### 5. Deploy your app

#### Option A: Standard Deployment

```bash
npm run build
```

Before deploying your app, you need to verify the domain by adding it to the [Domain allowlist](https://platform.openai.com/settings/organization/security/domain-allowlist) on your dashboard.

#### Option B: Docker with Virtual Display (Local VNC Access)

Run with VNC for visual debugging:

```bash
docker-compose -f docker-compose.virtual-display.yml up -d
```

Connect via VNC at `vnc://localhost:5900` (password: `password`) to see the browser automation in action.

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup instructions.

#### Option C: Google Cloud Run

Deploy to Cloud Run with virtual display support and SMS integration.

##### Prerequisites

1. Install and configure Google Cloud SDK:

```bash
# Install gcloud CLI (if not already installed)
# Visit: https://cloud.google.com/sdk/docs/install

# Login to Google Cloud
gcloud auth login

# Set your project ID
gcloud config set project YOUR_PROJECT_ID

# Configure Docker authentication
gcloud auth configure-docker
```

2. Enable required Google Cloud APIs:

```bash
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

##### Required Environment Variables

Set these environment variables before deployment:

```bash
# OpenAI Configuration (REQUIRED)
export OPENAI_API_KEY="sk-proj-xxxxx"                           # Your OpenAI API key
export NEXT_PUBLIC_WORKFLOW_ID="wf_xxxxx"               # Your ChatKit workflow ID
export NEXT_PUBLIC_CHATKIT_DOMAIN_KEY="domain_pk_xxxxx"         # Your ChatKit domain key

# Twilio Configuration (REQUIRED for SMS)
export TWILIO_ACCOUNT_SID="ACxxxxx"                             # Your Twilio Account SID
export TWILIO_API_KEY_SID="SKxxxxx"                             # Your Twilio API Key SID
export TWILIO_API_KEY_SECRET="xxxxx"                            # Your Twilio API Key Secret
export TWILIO_PHONE_NUMBER="+1234567890"                        # Your Twilio phone number

# Google Cloud Configuration (REQUIRED)
export GCP_PROJECT_ID="your-project-id"                         # Your GCP project ID
export GCP_REGION="us-central1"                                 # GCP region for deployment
export SERVICE_NAME="chatkit-virtual-display"                   # Cloud Run service name
```

##### Full Deployment Command

Deploy to Google Cloud Run with all configurations:

```bash
# 1. Build Docker image for Cloud Run (linux/amd64)
docker build --platform linux/amd64 \
  -f Dockerfile.virtual-display \
  --build-arg NEXT_PUBLIC_WORKFLOW_ID=$NEXT_PUBLIC_WORKFLOW_ID \
  --build-arg NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY \
  -t gcr.io/$GCP_PROJECT_ID/$SERVICE_NAME:latest .

# 2. Push Docker image to Google Container Registry
docker push gcr.io/$GCP_PROJECT_ID/$SERVICE_NAME:latest

# 3. Deploy to Cloud Run with all environment variables
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$GCP_PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region $GCP_REGION \
  --project $GCP_PROJECT_ID \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 10 \
  --memory 2Gi \
  --cpu 1 \
  --port 8080 \
  --timeout 300 \
  --set-env-vars "\
NODE_ENV=production,\
DISPLAY=:99,\
VIRTUAL_DISPLAY=true,\
BROWSER_VISIBLE=true,\
OPENAI_API_KEY=$OPENAI_API_KEY,\
NEXT_PUBLIC_WORKFLOW_ID=$NEXT_PUBLIC_WORKFLOW_ID,\
NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY,\
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID,\
TWILIO_API_KEY_SID=$TWILIO_API_KEY_SID,\
TWILIO_API_KEY_SECRET=$TWILIO_API_KEY_SECRET,\
TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER"
```

##### One-Line Deployment (Copy-Paste Ready)

```bash
export OPENAI_API_KEY="sk-proj-xxxxx" && \
export NEXT_PUBLIC_WORKFLOW_ID="wf_xxxxx" && \
export NEXT_PUBLIC_CHATKIT_DOMAIN_KEY="domain_pk_xxxxx" && \
export TWILIO_ACCOUNT_SID="ACxxxxx" && \
export TWILIO_API_KEY_SID="SKxxxxx" && \
export TWILIO_API_KEY_SECRET="xxxxx" && \
export TWILIO_PHONE_NUMBER="+1234567890" && \
export GCP_PROJECT_ID="your-project-id" && \
export GCP_REGION="us-central1" && \
export SERVICE_NAME="chatkit-virtual-display" && \
docker build --platform linux/amd64 -f Dockerfile.virtual-display --build-arg NEXT_PUBLIC_WORKFLOW_ID=$NEXT_PUBLIC_WORKFLOW_ID --build-arg NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY -t gcr.io/$GCP_PROJECT_ID/$SERVICE_NAME:latest . && \
docker push gcr.io/$GCP_PROJECT_ID/$SERVICE_NAME:latest && \
gcloud run deploy $SERVICE_NAME --image gcr.io/$GCP_PROJECT_ID/$SERVICE_NAME:latest --platform managed --region $GCP_REGION --project $GCP_PROJECT_ID --allow-unauthenticated --min-instances 0 --max-instances 10 --memory 2Gi --cpu 1 --port 8080 --timeout 300 --set-env-vars "NODE_ENV=production,DISPLAY=:99,VIRTUAL_DISPLAY=true,BROWSER_VISIBLE=true,OPENAI_API_KEY=$OPENAI_API_KEY,NEXT_PUBLIC_WORKFLOW_ID=$NEXT_PUBLIC_WORKFLOW_ID,NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY,TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID,TWILIO_API_KEY_SID=$TWILIO_API_KEY_SID,TWILIO_API_KEY_SECRET=$TWILIO_API_KEY_SECRET,TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER"
```

##### Update Existing Deployment (Add/Update Environment Variables)

If you need to update environment variables on an existing deployment:

```bash
gcloud run services update $SERVICE_NAME \
  --platform managed \
  --region $GCP_REGION \
  --project $GCP_PROJECT_ID \
  --update-env-vars "\
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID,\
TWILIO_API_KEY_SID=$TWILIO_API_KEY_SID,\
TWILIO_API_KEY_SECRET=$TWILIO_API_KEY_SECRET,\
TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER"
```

##### Configure Twilio Webhook

After deployment, configure your Twilio phone number:

1. Get your Cloud Run webhook URL:

```bash
gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $GCP_REGION \
  --format 'value(status.url)'
```

2. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
3. Select your phone number
4. Under "Messaging Configuration" → "A MESSAGE COMES IN":
   - **Webhook URL**: `https://YOUR-SERVICE-URL.run.app/api/sms-webhook`
   - **HTTP Method**: `POST`
5. Click "Save"

##### Verify Deployment

```bash
# Check service status
gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $GCP_REGION \
  --format yaml

# View logs
gcloud logging read "resource.labels.service_name=$SERVICE_NAME" \
  --limit 50 \
  --format json

# Test health endpoint
curl https://YOUR-SERVICE-URL.run.app/api/health
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for comprehensive deployment guide covering all deployment options.

## Project Structure

```
.
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── create-session/    # ChatKit session endpoint
│   │   └── sms-webhook/       # Twilio SMS webhook
├── components/            # React components
├── scripts/               # Deployment scripts
│   ├── deploy-cloudrun-virtual-display.sh
│   └── start-with-display.sh
├── screenshots/           # Example screenshots
├── tests/                 # Test files
├── docker-compose.virtual-display.yml    # Single VNC configuration
└── Dockerfile.virtual-display            # Docker image with Xvfb/VNC
```

## SMS Integration

This app includes Twilio webhook support for SMS-to-ChatKit conversations:

1. **Configure Twilio**: Set up a Twilio phone number and add webhook URL
2. **Set Environment Variables**: Add `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, and `TWILIO_PHONE_NUMBER` to `.env.local`
3. **Send SMS**: Text your Twilio number to start a conversation
4. **View in VNC**: If using virtual display, watch the browser automation in real-time via VNC

See [TWILIO_INTEGRATION.md](TWILIO_INTEGRATION.md) for detailed setup instructions and troubleshooting.

## Testing

Run comprehensive test suite:

```bash
# Test virtual display
node tests/test-virtual-display.js

# Test ChatKit integration
node tests/test-chatkit-visible.js

# Test SMS integration
node tests/test-sms-direct-injection.js

# Capture screenshot
node tests/capture-vnc-test-screenshot.js
```

See [tests/README.md](tests/README.md) for all available tests.

## Customization Tips

- Adjust starter prompts, greeting text, [chatkit theme](https://chatkit.studio/playground), and placeholder copy in [`lib/config.ts`](lib/config.ts)
- Update the event handlers inside [`components/ChatKitPanel.tsx`](components/ChatKitPanel.tsx) to integrate with your product analytics or storage
- Modify VNC configuration in [`scripts/start-with-display.sh`](scripts/start-with-display.sh)

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Complete system architecture, technology stack, and design patterns
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Comprehensive deployment guide for local, Docker, and Google Cloud Run
- **[TWILIO_INTEGRATION.md](TWILIO_INTEGRATION.md)** - SMS integration setup, testing, and troubleshooting
- [Testing Guide](tests/README.md) - Available tests and how to run them

## Architecture

### Local Development

- Standard Next.js dev server at `localhost:3000`
- Hot reload for rapid development

### Virtual Display (Docker)

- Xvfb provides virtual X server on display `:99`
- x11vnc shares display via VNC on port `5900`
- Non-headless Chromium browsers for automation
- VNC access for real-time visual debugging

### Cloud Run

- Virtual display without VNC (no remote access)
- Non-headless browsers for ChatKit compatibility
- Screenshot capture for monitoring
- Scales to zero when idle

## References

- [ChatKit JavaScript Library](http://openai.github.io/chatkit-js/)
- [Advanced Self-Hosting Examples](https://github.com/openai/openai-chatkit-advanced-samples)
- [Xvfb Documentation](https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml)
- [x11vnc Documentation](https://github.com/LibVNC/x11vnc)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
