# Msg2AgentBuilder - Complete Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Deployment (Virtual Display + VNC)](#docker-deployment-virtual-display--vnc)
4. [Google Cloud Run Deployment](#google-cloud-run-deployment)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Troubleshooting](#troubleshooting)
7. [Post-Deployment Configuration](#post-deployment-configuration)

---

## Prerequisites

### Required Accounts & Services

1. **OpenAI Account**
   - Sign up at https://platform.openai.com/
   - Create an API key at https://platform.openai.com/api-keys
   - Create a workflow in [Agent Builder](https://platform.openai.com/agent-builder)
   - Note your workflow ID (starts with `wf_`)
   - Get your domain key from ChatKit settings

2. **Twilio Account** (for SMS integration)
   - Sign up at https://www.twilio.com/
   - Get your Account SID, Auth Token, and Phone Number
   - See [TWILIO_INTEGRATION.md](./TWILIO_INTEGRATION.md) for detailed setup

3. **Google Cloud Account** (for Cloud Run deployment)
   - Create a project at https://console.cloud.google.com/
   - Enable billing
   - Install gcloud CLI: https://cloud.google.com/sdk/docs/install

### Required Software

#### For Local Development:

- Node.js 20.x or later
- npm 10.x or later
- Git

#### For Docker Deployment:

- Docker Desktop (latest version)
- Docker Compose v2.x

#### For Cloud Deployment:

- gcloud CLI (latest version)
- Docker (for building images)

---

## Local Development Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/RethinkLedgers/msg2agentbuilder.git
cd msg2agentbuilder
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials. See the [Environment Variables Reference](#environment-variables-reference) section below for details on obtaining each value.

**Required for local development:**

```bash
# OpenAI Configuration (Required)
OPENAI_API_KEY=sk-proj-your_actual_key_here
NEXT_PUBLIC_WORKFLOW_ID=wf_your_workflow_id_here
NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=domain_pk_your_domain_key_here
```

**Required for SMS functionality:**

```bash
# Twilio Configuration (3 credentials required)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=your_api_key_secret_here
TWILIO_PHONE_NUMBER=+1234567890
```

**Optional:**

```bash
# Application URL (for production webhooks)
APP_URL=

# VNC Password (for Docker virtual display debugging)
VNC_PASSWORD=password
```

### Step 4: Set Up ngrok for Local Development

**Important**: OpenAI's domain allowlist does not accept `localhost` as a valid domain. You must use ngrok to create a public URL for local development.

#### 4.1. Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

#### 4.2. Sign up and authenticate ngrok

1. Sign up for a free account at https://dashboard.ngrok.com/signup
2. Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
3. Configure ngrok:

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

#### 4.3. Start the development server

```bash
npm run dev
```

Note the port number (e.g., `http://localhost:3001`)

#### 4.4. Start ngrok tunnel

In a new terminal:

```bash
ngrok http 3001
```

Replace `3001` with the actual port your dev server is using.

You'll see output like:

```
Forwarding    https://abc123def456.ngrok-free.app -> http://localhost:3001
```

**Copy the ngrok URL** (e.g., `abc123def456.ngrok-free.app` without `https://`)

#### 4.5. Add ngrok domain to OpenAI

1. Go to https://platform.openai.com/settings/organization/domain-allowlist
2. Click **"Add Domain"**
3. Enter your ngrok domain (e.g., `abc123def456.ngrok-free.app`)
4. Copy the generated **domain key** (starts with `domain_pk_`)

#### 4.6. Update .env.local with ngrok domain key

Replace the `NEXT_PUBLIC_CHATKIT_DOMAIN_KEY` in your `.env.local`:

```bash
NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=domain_pk_your_new_key_here
```

#### 4.7. Restart the development server

Stop the dev server (Ctrl+C) and restart:

```bash
npm run dev
```

**Important Notes:**

- Access your application via the **ngrok URL** (not localhost)
- ngrok URLs change each time you restart ngrok (free plan)
- You'll need to update the domain in OpenAI's allowlist when the ngrok URL changes

### Step 5: Test the Application

1. Open your **ngrok URL** in your browser (e.g., `https://abc123def456.ngrok-free.app`)
2. You should see the ChatKit UI with the title "Msg2AgentBuilder - SMS Integration with Agent Builder (OpenAI)"
3. Try typing a message in the chat interface
4. Verify AI responses are working

### Development Features

- **Hot Module Replacement**: Code changes reload automatically
- **Source Maps**: Easy debugging with original source code
- **Console Logs**: Verbose logging in development mode

---

## Docker Deployment (Virtual Display + VNC)

This deployment mode runs the application in a Docker container with a virtual display (Xvfb) and VNC server for visual debugging.

### When to Use This Mode

- **Browser Automation Testing**: Watch Puppeteer/Chromium in real-time
- **Visual Debugging**: See ChatKit UI render visually
- **Screenshot Capture**: Test OCR and image processing
- **Development**: Replicate production environment locally

### Step 1: Prepare Environment

Ensure Docker Desktop is running:

```bash
docker --version
docker-compose --version
```

### Step 2: Build and Start Container

```bash
docker-compose -f docker-compose.virtual-display.yml up -d
```

**Build Time**: 5-10 minutes (first time, downloads dependencies)

### Step 3: Verify Container Status

```bash
docker ps
```

You should see:

```
CONTAINER ID   IMAGE                    STATUS         PORTS
abc123def456   chatkit-app-virtual...   Up 2 minutes   0.0.0.0:3003->3000/tcp, 0.0.0.0:5900->5900/tcp
```

### Step 4: Access the Application

#### Local Access (localhost only):

**Web Interface:**

```
http://localhost:3003
```

**VNC Interface:**

```
vnc://localhost:5900
Password: password
```

**VNC Clients**:

- **macOS**: Built-in Screen Sharing (`open vnc://localhost:5900`)
- **Windows**: [RealVNC Viewer](https://www.realvnc.com/en/connect/download/viewer/)
- **Linux**: [TigerVNC](https://tigervnc.org/) or Remmina

#### Public Access with ngrok (Required for ChatKit):

**Important**: Since OpenAI's domain allowlist doesn't accept `localhost`, you need ngrok for full ChatKit functionality.

**4.1. Start ngrok tunnel:**

In a new terminal:

```bash
ngrok http 3003
```

You'll see output like:

```
Forwarding    https://abc123def456.ngrok-free.app -> http://localhost:3003
```

**4.2. Add ngrok domain to OpenAI:**

1. Copy the ngrok domain (e.g., `abc123def456.ngrok-free.app`)
2. Go to https://platform.openai.com/settings/organization/domain-allowlist
3. Click **"Add Domain"** and enter your ngrok domain
4. Copy the generated **domain key** (starts with `domain_pk_`)

**4.3. Update .env.local:**

Replace the `NEXT_PUBLIC_CHATKIT_DOMAIN_KEY`:

```bash
NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=domain_pk_your_new_key_here
```

**4.4. Restart Docker container:**

```bash
docker-compose -f docker-compose.virtual-display.yml restart
```

**4.5. Access via ngrok:**

```
https://abc123def456.ngrok-free.app
```

Now you have:

- ✅ Full ChatKit functionality (via ngrok URL)
- ✅ VNC access to watch browser automation (`vnc://localhost:5900`)
- ✅ Local HTTP access for debugging (`http://localhost:3003`)

### Step 5: Watch Browser Automation

1. Connect via VNC to `localhost:5900`
2. You'll see a Fluxbox desktop environment
3. When SMS messages are received, Chromium windows will appear
4. Watch ChatKit UI render and respond in real-time

### Managing the Container

**Stop**:

```bash
docker-compose -f docker-compose.virtual-display.yml down
```

**Restart**:

```bash
docker-compose -f docker-compose.virtual-display.yml restart
```

**View Logs**:

```bash
docker logs -f msg2agentbuilder-app-virtual-display-1
```

**Rebuild** (after code changes):

```bash
docker-compose -f docker-compose.virtual-display.yml up -d --build
```

### Port Configuration

| Port | Service     | Access                |
| ---- | ----------- | --------------------- |
| 3003 | Next.js App | http://localhost:3003 |
| 5900 | VNC Server  | vnc://localhost:5900  |

### Complete Docker + ngrok + VNC Workflow

Here's the complete workflow for running the application with Docker, ngrok, and VNC:

**Step-by-Step Example:**

```bash
# 1. Ensure .env.local is configured
cp .env.example .env.local
# Edit .env.local with your credentials

# 2. Start Docker container with virtual display
docker-compose -f docker-compose.virtual-display.yml up -d --build

# 3. Verify container is running
docker ps
# Should show: msg2agentbuilder-app-virtual-display-1

# 4. In a new terminal, start ngrok
ngrok http 3003
# Copy the ngrok URL (e.g., abc123.ngrok-free.app)

# 5. Add ngrok domain to OpenAI allowlist
# Visit: https://platform.openai.com/settings/organization/domain-allowlist
# Add domain and copy the domain key

# 6. Update .env.local with the new domain key
# NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=domain_pk_xxxxx

# 7. Restart Docker container to apply changes
docker-compose -f docker-compose.virtual-display.yml restart

# 8. Connect via VNC to watch browser automation
open vnc://localhost:5900
# Password: password

# 9. Access application via ngrok URL
# Open browser: https://abc123.ngrok-free.app

# 10. (Optional) Configure Twilio webhook
# Webhook URL: https://abc123.ngrok-free.app/api/sms-webhook
```

**What You Get:**

✅ **Full Production Environment** - Docker container with Xvfb + Chromium
✅ **ChatKit Functionality** - Working via ngrok public URL
✅ **Visual Debugging** - VNC access to watch browser automation
✅ **SMS Integration** - Ready for Twilio webhook testing
✅ **Hot Reload** - Code changes reflected (if using volumes)

**Useful Commands:**

```bash
# View container logs
docker logs -f msg2agentbuilder-app-virtual-display-1

# Restart after .env.local changes
docker-compose -f docker-compose.virtual-display.yml restart

# Stop everything
docker-compose -f docker-compose.virtual-display.yml down
pkill ngrok

# Rebuild after code changes
docker-compose -f docker-compose.virtual-display.yml up -d --build
```

### Troubleshooting Docker Deployment

#### Environment Variables Not Loading

**Problem**: Changes to `.env.local` are not reflected in the running container.

**Solution**: The Docker Compose configuration uses `env_file: .env.local` to automatically load environment variables. However, changes require **recreating** the container (not just restarting):

```bash
# Stop and recreate container (picks up new .env.local values)
docker-compose -f docker-compose.virtual-display.yml down
docker-compose -f docker-compose.virtual-display.yml up -d
```

**Verify environment variables are loaded correctly**:

```bash
# Check specific variable
docker exec msg2agentbuilder-app-virtual-display-1 printenv TWILIO_PHONE_NUMBER

# Check all Twilio variables
docker exec msg2agentbuilder-app-virtual-display-1 printenv | grep TWILIO
```

#### Twilio SMS Not Sending

**Problem**: SMS responses are captured but not sent to users.

**Common Causes**:

1. **Wrong Phone Number**: Verify you're using a phone number that exists in your Twilio account:

```bash
# List all phone numbers in your Twilio account
curl -X GET "https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/IncomingPhoneNumbers.json" \
  -u "YOUR_API_KEY_SID:YOUR_API_KEY_SECRET"
```

2. **Phone Number Mismatch**: Ensure `.env.local` has the exact phone number from your Twilio account (including country code):

```bash
# Check what's in .env.local
grep TWILIO_PHONE_NUMBER .env.local

# Example: TWILIO_PHONE_NUMBER=+19803971525
```

3. **Verify in Container**:

```bash
# Verify correct number is loaded in running container
docker exec msg2agentbuilder-app-virtual-display-1 printenv TWILIO_PHONE_NUMBER
```

If the number is wrong, update `.env.local` and recreate the container.

#### OCR Fallback Capturing Sensitive Data

**Problem**: OCR fallback is reading API keys or other sensitive information from the screen.

**Solution**: Disable OCR fallback by setting in `.env.local`:

```bash
DISABLE_OCR_FALLBACK=true
```

This forces the system to use only SSE (Server-Sent Events) capture, which is more reliable and doesn't read from screenshots. If SSE fails, you'll get a clear error message instead of incorrect OCR results.

#### Checking Logs for Errors

```bash
# Follow logs in real-time
docker logs -f msg2agentbuilder-app-virtual-display-1

# Filter for SMS-related logs
docker logs msg2agentbuilder-app-virtual-display-1 --tail 100 | grep -i sms

# Filter for errors
docker logs msg2agentbuilder-app-virtual-display-1 --tail 100 | grep -i error
```

---

## Google Cloud Run Deployment

Deploy the application to Google Cloud Run for production use with auto-scaling and managed infrastructure.

### Architecture Overview

```
Internet → Cloud Load Balancer → Cloud Run → Xvfb + Chromium + Next.js
```

**Features**:

- Auto-scaling (0 to 10 instances)
- Pay-per-use pricing
- Automatic HTTPS
- Global CDN
- Monitoring & logging

### Step 1: Install and Configure gcloud CLI

```bash
# Install gcloud (if not already installed)
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash

# Windows
# Download from: https://cloud.google.com/sdk/docs/install

# Initialize gcloud
gcloud init

# Login
gcloud auth login

# Configure Docker authentication
gcloud auth configure-docker
```

### Step 2: Create Google Cloud Project

```bash
# Create project
gcloud projects create YOUR_PROJECT_ID --name="Msg2AgentBuilder"

# Set as active project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com
```

### Step 3: Set Up Environment Variables

All configuration is now managed through `.env.local`. Configure your deployment variables:

```bash
# Copy the example file if you haven't already
cp .env.example .env.local

# Edit .env.local and fill in all required values
nano .env.local  # or use your preferred editor
```

**Required sections to configure in `.env.local`:**

1. **OpenAI Configuration** - Get from https://platform.openai.com/
2. **Twilio Configuration** - Get from https://console.twilio.com/
3. **Google Cloud Deployment Configuration** - Your GCP project details

The deployment scripts will automatically load configuration from `.env.local`.

**Example `.env.local` configuration:**

```bash
# Google Cloud Configuration
GCP_PROJECT_ID=your-project-id
GCP_SERVICE_NAME=chatkit-app
GCP_REGION=us-central1
GCP_MIN_INSTANCES=0
GCP_MAX_INSTANCES=10
GCP_MEMORY=2Gi
GCP_CPU=1

# (... plus OpenAI and Twilio credentials as shown in .env.example)
```

### Step 4: Option A - Deploy Using Deployment Script (Recommended)

The easiest way to deploy is using the provided deployment scripts. They automatically load configuration from `.env.local`:

```bash
# For standard deployment
./scripts/deploy-cloudrun.sh

# OR for virtual display deployment (includes Xvfb for browser automation)
./scripts/deploy-cloudrun-virtual-display.sh

# OR using Cloud Build
./scripts/deploy-with-cloudbuild.sh
```

**Build Time**: 10-15 minutes (first deployment)

These scripts will:

1. Load environment variables from `.env.local`
2. Build and deploy your application to Cloud Run
3. Configure all necessary settings automatically
4. Return your deployed service URL

### Step 4: Option B - Deploy Using Local Docker Build

Build and push Docker image manually:

```bash
# Build image (Platform must be linux/amd64 for Cloud Run)
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_WORKFLOW_ID="${NEXT_PUBLIC_WORKFLOW_ID}" \
  --build-arg NEXT_PUBLIC_CHATKIT_DOMAIN_KEY="${NEXT_PUBLIC_CHATKIT_DOMAIN_KEY}" \
  -t gcr.io/${GCP_PROJECT_ID}/${SERVICE_NAME}:latest \
  -f Dockerfile \
  .

# Push to Container Registry
docker push gcr.io/${GCP_PROJECT_ID}/${SERVICE_NAME}:latest

# Deploy to Cloud Run
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${GCP_PROJECT_ID}/${SERVICE_NAME}:latest \
  --region ${GCP_REGION} \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "\
OPENAI_API_KEY=${OPENAI_API_KEY},\
TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID},\
TWILIO_API_KEY_SID=${TWILIO_API_KEY_SID},\
TWILIO_API_KEY_SECRET=${TWILIO_API_KEY_SECRET},\
TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER},\
NODE_ENV=production,\
PORT=8080"
```

### Step 5: Verify Deployment

```bash
# Get service URL
gcloud run services describe ${SERVICE_NAME} \
  --region ${GCP_REGION} \
  --format='value(status.url)'
```

Example output:

```
https://chatkit-app-abc123-uc.a.run.app
```

**Test the deployment**:

```bash
curl https://YOUR_SERVICE_URL.run.app/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-23T12:00:00.000Z"
}
```

### Step 6: Configure Custom Domain (Optional)

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service ${SERVICE_NAME} \
  --domain sms.yourdomain.com \
  --region ${GCP_REGION}

# Add DNS records as instructed by gcloud
```

### Step 7: Configure Twilio Webhook

After deployment, configure Twilio to send SMS to your Cloud Run endpoint.

See [TWILIO_INTEGRATION.md](./TWILIO_INTEGRATION.md) for detailed instructions.

**Webhook URL Format**:

```
https://YOUR_SERVICE_URL.run.app/api/sms-webhook
```

---

## Environment Variables Reference

### Required Variables

#### OpenAI Configuration

| Variable                         | Description               | Example              | Required For    |
| -------------------------------- | ------------------------- | -------------------- | --------------- |
| `OPENAI_API_KEY`                 | OpenAI API key            | `sk-proj-abc123...`  | All deployments |
| `NEXT_PUBLIC_WORKFLOW_ID`        | Agent Builder workflow ID | `wf_68ee55e3fb...`   | All deployments |
| `NEXT_PUBLIC_CHATKIT_DOMAIN_KEY` | ChatKit domain key        | `domain_pk_68f03...` | All deployments |

**Getting these values**:

1. API Key: https://platform.openai.com/api-keys
2. Workflow ID: https://platform.openai.com/agent-builder → Create/publish workflow
3. **Domain Key**: See detailed instructions below

**Getting Your ChatKit Domain Key:**

The domain key authenticates your domain with OpenAI's ChatKit service. Follow these steps:

1. Go to [OpenAI Domain Allowlist Settings](https://platform.openai.com/settings/organization/domain-allowlist)
2. Click **"Add Domain"**
3. Enter your domain:
   - **For local development**: Use your **ngrok domain** (e.g., `abc123.ngrok-free.app`) - See [Local Development Setup](#local-development-setup) for ngrok setup instructions
   - **For Cloud Run**: Enter your Cloud Run URL (e.g., `your-app-name.run.app`)
   - **For custom domain**: Enter your full domain (e.g., `yourdomain.com`)
4. After adding the domain, OpenAI will generate a **domain key** starting with `domain_pk_`
5. Copy this domain key to your `.env.local` file as `NEXT_PUBLIC_CHATKIT_DOMAIN_KEY`

**Important Notes:**

- ⚠️ **`localhost` is NOT accepted** by OpenAI's domain allowlist - you must use ngrok or deploy to Cloud Run
- You will need separate domain keys for local development (ngrok) and production (Cloud Run)
- Domain keys are public and safe to include in client-side code
- Changes to domain allowlist may take a few minutes to propagate
- Free ngrok URLs change on restart, requiring a new domain key each time

#### Twilio Configuration

| Variable                | Description                        | Example         | Required For    |
| ----------------------- | ---------------------------------- | --------------- | --------------- |
| `TWILIO_ACCOUNT_SID`    | Twilio account identifier          | `ACxxxxxxxx...` | SMS integration |
| `TWILIO_API_KEY_SID`    | Twilio API Key SID                 | `SKxxxxxxxx...` | SMS integration |
| `TWILIO_API_KEY_SECRET` | Twilio API Key Secret              | `abc123...`     | SMS integration |
| `TWILIO_PHONE_NUMBER`   | Twilio phone number (E.164 format) | `+1234567890`   | SMS integration |

**Getting these values**:

1. Sign up at https://www.twilio.com/
2. Go to **Console → Account Info** to get your Account SID
3. Create API Keys (required for authentication):
   - Go to **Console → Account → API keys & tokens**
   - Click **Create API Key**
   - Give it a friendly name (e.g., "Msg2AgentBuilder Production")
   - Copy the **SID** and **Secret** immediately (you won't be able to see the secret again!)
4. Purchase a phone number with SMS capability at **Console → Phone Numbers**

**Note:** This application uses API Key authentication (more secure than Auth Token). You need all 3 credentials above.

### Optional Variables

| Variable                    | Description         | Default                     | Notes                             |
| --------------------------- | ------------------- | --------------------------- | --------------------------------- |
| `PORT`                      | Server port         | `3000` (dev), `8080` (prod) | Cloud Run requires 8080           |
| `NODE_ENV`                  | Environment         | `development`               | Set to `production` for Cloud Run |
| `VNC_PASSWORD`              | VNC server password | `password`                  | Docker virtual display only       |
| `APP_URL`                   | Application URL     | Auto-detected               | For SMS webhook callbacks         |
| `PUPPETEER_EXECUTABLE_PATH` | Chromium path       | `/usr/bin/chromium`         | Custom browser location           |
| `DISPLAY`                   | X display server    | `:99`                       | Virtual display mode              |

### Build-Time vs Runtime Variables

**Build-Time** (embedded in Next.js bundle):

- `NEXT_PUBLIC_WORKFLOW_ID`
- `NEXT_PUBLIC_CHATKIT_DOMAIN_KEY`

These must be set during `npm run build` or Docker build.

**Runtime** (can be changed without rebuild):

- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY_SID`
- `TWILIO_API_KEY_SECRET`
- `TWILIO_PHONE_NUMBER`
- `APP_URL`
- `PORT`
- `NODE_ENV`

---

## Troubleshooting

### Local Development Issues

#### Issue: "Module not found" errors

**Solution**:

```bash
rm -rf node_modules package-lock.json
npm install
```

#### Issue: "Port 3000 already in use"

**Solution**:

```bash
# Find process on port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

#### Issue: ChatKit UI not loading

**Symptoms**: Blank screen, no errors

**Diagnosis**:

1. Check browser console for errors
2. Verify workflow ID and domain key are correct
3. Check OpenAI API key is valid

**Solution**:

```bash
# Verify environment variables
npm run dev
# Check console output for loaded env vars
```

### Docker Deployment Issues

#### Issue: Container fails to start

**Diagnosis**:

```bash
docker logs openai-chatkit-starter-app-app-virtual-display-1
```

**Common Causes**:

- Missing environment variables
- Port conflicts
- Docker daemon not running

**Solution**:

```bash
# Check Docker is running
docker ps

# Rebuild from scratch
docker-compose -f docker-compose.virtual-display.yml down -v
docker-compose -f docker-compose.virtual-display.yml up -d --build
```

#### Issue: Cannot connect to VNC

**Diagnosis**:

```bash
# Check port 5900 is exposed
docker ps | grep 5900

# Check VNC server is running inside container
docker exec -it msg2agentbuilder-app-virtual-display-1 ps aux | grep vnc
```

**Solution**:

```bash
# Restart container
docker-compose -f docker-compose.virtual-display.yml restart

# Try different VNC client
# macOS: open vnc://localhost:5900
# Windows/Linux: Use TigerVNC or RealVNC
```

### Cloud Run Deployment Issues

#### Issue: Build fails with "out of memory"

**Error**: `JavaScript heap out of memory`

**Solution**:
The Dockerfile already includes memory optimization. If still failing:

```dockerfile
# In Dockerfile, increase memory limit
ENV NODE_OPTIONS="--max-old-space-size=8192"
```

#### Issue: "Please enter a valid Workflow ID" error

**Cause**: Workflow ID not embedded in build

**Solution**:
Ensure `NEXT_PUBLIC_WORKFLOW_ID` is passed during build:

```bash
# Cloud Build
gcloud builds submit --substitutions=_NEXT_PUBLIC_WORKFLOW_ID="wf_..."

# Docker build
docker build --build-arg NEXT_PUBLIC_WORKFLOW_ID="wf_..." ...
```

#### Issue: 401 Authentication errors

**Diagnosis**:

```bash
# Check Cloud Run logs
gcloud run services logs read ${SERVICE_NAME} --region ${GCP_REGION} --limit 50
```

**Common Causes**:

- Invalid OpenAI API key
- Domain not in allowlist
- Workflow not published

**Solution**:

1. Verify API key: https://platform.openai.com/api-keys
2. Add domain to allowlist: https://platform.openai.com/settings/organization/security/domain-allowlist
3. Republish workflow in Agent Builder

#### Issue: SMS webhook timing out

**Symptoms**: Twilio reports "No response from webhook"

**Cause**: Cold start (30-60s) exceeds Twilio's 10s timeout

**Solution**:

1. **Increase Twilio timeout**:

   ```
   Configure → Phone Numbers → [Your Number] → Voice & Fax
   Set "Timeout" to 60 seconds
   ```

2. **Keep instance warm** (paid approach):

   ```bash
   gcloud run services update ${SERVICE_NAME} \
     --region ${GCP_REGION} \
     --min-instances 1
   ```

3. **Implement async processing**:
   - Return 200 OK immediately
   - Process in background
   - Use callbacks for response

### Performance Issues

#### Issue: Slow SMS responses

**Diagnosis**:

- Check Cloud Run logs for timing
- Identify bottleneck (cold start, browser launch, AI inference)

**Optimization Strategies**:

1. **Reduce cold start**:

   ```bash
   # Keep 1 instance warm
   gcloud run services update ${SERVICE_NAME} --min-instances 1
   ```

2. **Browser session reuse**:
   - Already implemented (30-min timeout)
   - Verify in logs: "Reusing existing browser session"

3. **Optimize AI model**:
   - Use faster models in Agent Builder
   - Reduce prompt complexity

4. **Monitor metrics**:
   ```bash
   gcloud monitoring dashboards list
   # Find Cloud Run dashboard
   ```

---

## Post-Deployment Configuration

### 1. Add Domain to OpenAI Allowlist

Navigate to: https://platform.openai.com/settings/organization/security/domain-allowlist

Add your Cloud Run domain:

```
chatkit-app-abc123-uc.a.run.app
```

Or custom domain:

```
sms.yourdomain.com
```

### 2. Configure Twilio Webhook

See [TWILIO_INTEGRATION.md](./TWILIO_INTEGRATION.md) for detailed setup.

Summary:

1. Go to Twilio Console → Phone Numbers
2. Click your phone number
3. Under "Messaging", set Webhook URL to:
   ```
   https://YOUR_SERVICE_URL.run.app/api/sms-webhook
   ```
4. Set HTTP Method to `POST`
5. Save

### 3. Test End-to-End Flow

Send a test SMS:

```
Send to: [Your Twilio number]
Message: "Hello, what's 2+2?"
```

Expected:

1. Twilio receives SMS
2. Forwards to your Cloud Run webhook
3. Browser session processes message
4. ChatKit generates response
5. Response sent back via SMS
6. You receive: "4" (or similar AI response)

**Verify in logs**:

```bash
gcloud run services logs read ${SERVICE_NAME} --region ${GCP_REGION} --limit 100
```

Look for:

```
[sms-webhook] Incoming SMS from +1234567890
[browserless] Creating new browser session
[ChatKitPanel] ✅ SMS successfully injected
[SSE Intercept] 📝 Response captured
[send-sms] ✅ SMS sent successfully
```

### 4. Set Up Monitoring

**Cloud Monitoring**:

```bash
# Create uptime check
gcloud monitoring uptime create \
  https://YOUR_SERVICE_URL.run.app/api/health \
  --display-name="Msg2AgentBuilder Health Check"
```

**Alert Policies**:

- Error rate > 5%
- Response time > 30s
- Instance count > 8

### 5. Configure Billing Alerts

```bash
# Set budget alert
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="Msg2AgentBuilder Budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] OpenAI API key obtained
- [ ] Agent Builder workflow created and published
- [ ] ChatKit domain key obtained
- [ ] Twilio account created (if using SMS)
- [ ] Twilio phone number purchased
- [ ] Google Cloud project created
- [ ] gcloud CLI installed and configured
- [ ] Environment variables documented

### Deployment

- [ ] Code tested locally (`npm run dev`)
- [ ] Docker build tested (if using Docker)
- [ ] Cloud Run deployment successful
- [ ] Service URL obtained
- [ ] Health check endpoint responding
- [ ] Logs showing no errors

### Post-Deployment

- [ ] Domain added to OpenAI allowlist
- [ ] Twilio webhook configured
- [ ] End-to-end SMS test successful
- [ ] Monitoring alerts configured
- [ ] Billing alerts configured
- [ ] Documentation updated with URLs
- [ ] Team notified of deployment

---

## Cost Estimation

### Google Cloud Run

**Pricing** (as of 2025):

- CPU: $0.00002400 per vCPU-second
- Memory: $0.00000250 per GiB-second
- Requests: $0.40 per million requests
- Free tier: 2 million requests/month

**Example Monthly Cost**:

- 10,000 SMS/month
- Average 10s per SMS
- 1 vCPU, 2GB RAM per instance

Calculation:

```
CPU: 10,000 * 10s * $0.000024 = $2.40
Memory: 10,000 * 10s * 2GB * $0.0000025 = $0.50
Requests: 10,000 * $0.0000004 = $0.004
Total: ~$3/month (+ free tier credit)
```

### Twilio

- SMS: $0.0079 per outbound SMS (US)
- Phone number: $1.15/month

**Example**:

- 10,000 SMS/month
- Cost: 10,000 \* $0.0079 = $79/month

### OpenAI

- Pricing varies by model
- GPT-4: ~$0.03 per 1K tokens
- GPT-3.5: ~$0.002 per 1K tokens

**Example** (GPT-3.5):

- 10,000 messages
- Avg 100 tokens per message
- Cost: 10,000 _ 0.1K _ $0.002 = $2/month

**Total Monthly Cost** (example): ~$85/month

---

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use Secret Manager** for production credentials
3. **Rotate API keys** regularly
4. **Enable Cloud Armor** for DDoS protection
5. **Use custom domain** with SSL/TLS
6. **Implement rate limiting** (already included)
7. **Monitor logs** for suspicious activity
8. **Keep dependencies updated**: `npm audit fix`

---

## Next Steps

After successful deployment:

1. **Scale**: Adjust `--max-instances` based on usage
2. **Optimize**: Monitor logs and identify bottlenecks
3. **Enhance**: Add features (conversation history, user management, etc.)
4. **Monitor**: Set up dashboards and alerts
5. **Document**: Update README with deployment-specific details

For questions or issues, see:

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design details
- [TWILIO_INTEGRATION.md](./TWILIO_INTEGRATION.md) - SMS setup
- [GitHub Issues](https://github.com/RethinkLedgers/msg2agentbuilder/issues)

---

**Deployment Complete!** 🎉

Your Msg2AgentBuilder application is now live and ready to handle SMS-to-AI conversations.
