# Msg2AgentBuilder - Architecture Overview

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Diagrams](#architecture-diagrams)
4. [Component Details](#component-details)
5. [Data Flow](#data-flow)
6. [Deployment Architectures](#deployment-architectures)

---

## System Overview

Msg2AgentBuilder is an SMS-to-AI integration platform that enables users to interact with OpenAI's ChatKit workflows via SMS messages. The system bridges Twilio's SMS infrastructure with OpenAI's Agent Builder, providing a conversational AI experience accessible through text messages.

### Key Capabilities

- **SMS-to-AI Conversations**: Send SMS messages and receive AI-powered responses
- **Workflow Flexibility**: Connect to any OpenAI Agent Builder workflow
- **Multi-Tenant Support**: Handle multiple concurrent user sessions
- **Web UI**: Optional browser-based interface for testing and configuration
- **Visual Debugging**: VNC support for browser automation troubleshooting

---

## Technology Stack

### Frontend

- **Next.js 15.5.4** - React framework with App Router
- **React 19.2.0** - UI component library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **OpenAI ChatKit** - Web component for AI chat interface

### Backend

- **Node.js 20** - JavaScript runtime
- **Next.js API Routes** - Serverless API endpoints
- **Puppeteer** - Headless browser automation
- **Chromium** - Browser engine for ChatKit rendering

### Infrastructure

- **Docker** - Containerization
- **Google Cloud Run** - Serverless container platform
- **Google Cloud Build** - CI/CD pipeline
- **Xvfb** - Virtual X server for headless display
- **x11vnc** - VNC server for remote access (development only)

### Third-Party Services

- **OpenAI API** - AI/ML inference
- **OpenAI ChatKit** - Conversational UI framework
- **OpenAI Agent Builder** - Workflow creation
- **Twilio** - SMS messaging platform

---

## Architecture Diagrams

### High-Level System Architecture

```
┌─────────────┐
│  SMS User   │
└──────┬──────┘
       │ SMS
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Twilio                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  • Receives SMS from user                                  │ │
│  │  • Forwards to webhook URL                                 │ │
│  │  • Sends AI responses back to user                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS Webhook
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Msg2AgentBuilder Application                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Next.js Application (Port 3000/8080)                      │ │
│  │                                                             │ │
│  │  API Routes:                                                │ │
│  │  ├─ /api/sms-webhook  ← Receives SMS from Twilio           │ │
│  │  ├─ /api/create-session ← Creates ChatKit sessions         │ │
│  │  └─ /api/send-sms     ← Sends SMS via Twilio               │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────┐          │ │
│  │  │  Puppeteer Browser Session Manager           │          │ │
│  │  │  ┌────────────────────────────────────────┐  │          │ │
│  │  │  │  Session Pool (per phone number)       │  │          │ │
│  │  │  │  ┌──────────────────────────────────┐  │  │          │ │
│  │  │  │  │  Chromium + ChatKit UI           │  │  │          │ │
│  │  │  │  │  ┌──────────────────────────────┐│  │  │          │ │
│  │  │  │  │  │  ChatKit Web Component       ││  │  │          │ │
│  │  │  │  │  │  - Renders AI chat UI        ││  │  │          │ │
│  │  │  │  │  │  - Manages conversation      ││  │  │          │ │
│  │  │  │  │  │  - Calls OpenAI API          ││  │  │          │ │
│  │  │  │  │  └──────────────────────────────┘│  │  │          │ │
│  │  │  │  └──────────────────────────────────┘  │  │          │ │
│  │  │  └────────────────────────────────────────┘  │          │ │
│  │  └──────────────────────────────────────────────┘          │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       OpenAI Platform                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  • ChatKit API (session creation)                          │ │
│  │  • Agent Builder workflows                                 │ │
│  │  • AI model inference (GPT-4, etc.)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### SMS Message Flow

```
1. User sends SMS
   └─> Twilio receives SMS
       └─> POST /api/sms-webhook
           └─> Get or create Puppeteer session for phone number
               └─> Load ChatKit UI in Chromium
                   └─> Inject SMS message via custom event
                       └─> ChatKit processes message
                           └─> OpenAI API generates response
                               └─> Response captured via SSE interception
                                   └─> POST /api/send-sms
                                       └─> Twilio sends SMS to user
```

---

## Component Details

### 1. Frontend Components

#### `ChatKitPanel.tsx`

**Purpose**: Main UI component that renders OpenAI ChatKit web component

**Key Features**:

- Renders `<openai-chatkit>` web component
- Manages workflow ID and domain key configuration
- Handles incoming SMS events in browserless mode
- Dispatches response events for SMS sending
- Provides dynamic API key input (optional)
- Dark/light theme support

**Props**:

```typescript
{
  theme: ColorScheme;          // 'light' | 'dark'
  onWidgetAction: (action) => void;
  onResponseEnd: () => void;
  onThemeRequest: (scheme) => void;
}
```

**State Management**:

- Session workflow ID
- API key (optional user-provided)
- Phone number (for active SMS conversation)
- Response text accumulation
- Error states

#### `App.tsx`

**Purpose**: Root application component

**Responsibilities**:

- Color scheme management
- Layout structure
- ChatKitPanel integration

### 2. API Routes

#### `/api/sms-webhook`

**Purpose**: Receives incoming SMS from Twilio and orchestrates AI response

**Flow**:

1. Validate Twilio signature (security)
2. Parse incoming SMS (from, body)
3. Get or create Puppeteer browser session for phone number
4. Load ChatKit UI at `http://localhost:3000` (or APP_URL)
5. Wait for ChatKit to initialize
6. Dispatch `incoming-sms` custom event with message
7. Wait for ChatKit to process and respond (via SSE interception)
8. Send AI response back via Twilio SMS
9. Return 200 OK

**Security Features**:

- Twilio signature validation
- Rate limiting (10 SMS/hour per number)
- Message length limits
- Input sanitization

**Browser Session Management**:

- One Chromium instance per phone number
- 30-minute idle timeout
- Automatic cleanup
- SSE response interception

#### `/api/create-session`

**Purpose**: Creates ChatKit sessions for the web component

**Flow**:

1. Receive request with workflow ID
2. Optionally accept user-provided API key
3. Call OpenAI ChatKit API to create session
4. Return client secret for ChatKit initialization

**Configuration**:

```typescript
{
  workflow: { id: workflowId },
  chatkit_configuration: {
    file_upload: { enabled: true },
    // ... other settings
  }
}
```

#### `/api/send-sms`

**Purpose**: Sends outbound SMS via Twilio

**Parameters**:

- `to`: Recipient phone number (E.164 format)
- `message`: SMS content (up to 1600 chars)

**Returns**: Success/failure status

### 3. Configuration (`lib/config.ts`)

**Exports**:

- `WORKFLOW_ID`: ChatKit workflow ID
- `DOMAIN_KEY`: ChatKit domain key
- `CREATE_SESSION_ENDPOINT`: API endpoint for sessions
- `STARTER_PROMPTS`: Default conversation starters
- `GREETING`: Welcome message
- `PLACEHOLDER_INPUT`: Input box placeholder
- `getThemeConfig()`: Theme customization

### 4. Browser Automation Layer

#### Puppeteer Session Manager

**Location**: `/api/sms-webhook/route.ts`

**Capabilities**:

- Launch Chromium with ChatKit UI
- Maintain session pool (Map<phoneNumber, BrowserSession>)
- Inject SMS messages via custom DOM events
- Capture AI responses via SSE interception
- Handle timeouts and errors
- Clean up inactive sessions

**SSE Interception**:

```typescript
page.on("response", async (response) => {
  if (url.includes("chatkit/conversation")) {
    const text = await response.text();
    // Parse SSE format: "data: {json}\n\n"
    // Extract assistant response
    // Store for SMS sending
  }
});
```

**Session Structure**:

```typescript
interface BrowserSession {
  browser: Browser;
  page: Page;
  phoneNumber: string;
  lastActivity: number;
  responseText: string;
}
```

---

## Data Flow

### SMS Inbound Flow

```
┌──────────────┐
│  User Phone  │
└──────┬───────┘
       │ SMS: "What is 2+2?"
       ▼
┌──────────────────────────────────┐
│  Twilio                          │
│  - Receives SMS                  │
│  - Parses message                │
└──────┬───────────────────────────┘
       │ POST /api/sms-webhook
       │ {
       │   From: "+1234567890",
       │   Body: "What is 2+2?"
       │ }
       ▼
┌────────────────────────────────────────────────┐
│  SMS Webhook Handler                           │
│  1. Validate Twilio signature                  │
│  2. Check rate limits                          │
│  3. Get/create browser session                 │
└──────┬─────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────┐
│  Puppeteer Browser Session                     │
│  - Chromium running on :99 display (Xvfb)      │
│  - Loads http://localhost:3000                 │
│  - ChatKitPanel renders                        │
└──────┬─────────────────────────────────────────┘
       │ window.dispatchEvent(new CustomEvent(
       │   'incoming-sms',
       │   { detail: { from: "+1234567890",
       │                message: "What is 2+2?" }}
       │ ))
       ▼
┌────────────────────────────────────────────────┐
│  ChatKitPanel Component                        │
│  - Receives 'incoming-sms' event               │
│  - Calls chatkit.sendUserMessage()             │
└──────┬─────────────────────────────────────────┘
       │ chatkit.sendUserMessage({ text: "What is 2+2?" })
       ▼
┌────────────────────────────────────────────────┐
│  ChatKit Web Component                         │
│  - Creates message in conversation             │
│  - Calls OpenAI API via ChatKit SDK            │
└──────┬─────────────────────────────────────────┘
       │ POST https://api.openai.com/v1/chatkit/conversation
       │ (SSE stream)
       ▼
┌────────────────────────────────────────────────┐
│  OpenAI Platform                               │
│  - Routes to Agent Builder workflow            │
│  - Executes AI model (GPT-4, etc.)             │
│  - Streams response via SSE                    │
└──────┬─────────────────────────────────────────┘
       │ SSE: data: {"message":{"content":[{"type":"output_text","text":"4"}]}}
       ▼
┌────────────────────────────────────────────────┐
│  Puppeteer SSE Interceptor                     │
│  - page.on('response') captures SSE stream     │
│  - Parses SSE format                           │
│  - Extracts assistant response: "4"            │
│  - Stores in session.responseText              │
└──────┬─────────────────────────────────────────┘
       │ responseText = "4"
       ▼
┌────────────────────────────────────────────────┐
│  SMS Webhook Handler (resumed)                 │
│  - Waits for response (max 60s)                │
│  - Gets responseText from session              │
└──────┬─────────────────────────────────────────┘
       │ POST /api/send-sms
       │ { to: "+1234567890", message: "4" }
       ▼
┌────────────────────────────────────────────────┐
│  Twilio                                        │
│  - Sends SMS to user                           │
└──────┬─────────────────────────────────────────┘
       │ SMS: "4"
       ▼
┌──────────────┐
│  User Phone  │
└──────────────┘
```

---

## Deployment Architectures

### Local Development

```
┌─────────────────────────────────────────────────┐
│  Developer Machine                              │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  npm run dev                               │ │
│  │  ├─ Next.js Dev Server (port 3000)         │ │
│  │  ├─ Hot Module Replacement                 │ │
│  │  └─ File watching                          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  Environment: .env.local                        │
│  Browser: System default                       │
│  Display: Native windowing system              │
└─────────────────────────────────────────────────┘
```

**Setup**:

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with credentials
npm run dev
```

**Access**: http://localhost:3000

### Docker with Virtual Display + VNC

```
┌─────────────────────────────────────────────────────────┐
│  Docker Container: chatkit-app-virtual-display          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Xvfb :99 (1920x1080x24)                           │ │
│  │  └─ Virtual X server (no physical display needed)  │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  x11vnc (port 5900)                                 │ │
│  │  └─ VNC server for remote viewing                  │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Fluxbox Window Manager                             │ │
│  │  └─ Lightweight desktop environment                │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Chromium Browser (DISPLAY=:99)                     │ │
│  │  └─ Renders ChatKit UI (visible in VNC)            │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                               │
│                          ▼                               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Next.js App (port 3000)                            │ │
│  │  └─ npm run dev (hot reload enabled)               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Volumes:                                                │
│  - ./app → /app/app (source code)                       │
│  - ./components → /app/components                       │
│  - ./lib → /app/lib                                     │
└─────────────────────────────────────────────────────────┘
       │                              │
       │ VNC (5900)                   │ HTTP (3003)
       ▼                              ▼
┌──────────────┐              ┌──────────────┐
│  VNC Viewer  │              │  Web Browser │
│  (localhost: │              │  (localhost: │
│   5900)      │              │   3003)      │
└──────────────┘              └──────────────┘
```

**Setup**:

```bash
docker-compose -f docker-compose.virtual-display.yml up -d
```

**Access**:

- App: http://localhost:3003
- VNC: `vnc://localhost:5900` (password: `password`)

**Use Cases**:

- Visual debugging of browser automation
- Screenshot capture for testing
- Troubleshooting ChatKit UI issues
- Watching SMS-to-AI interactions in real-time

### Google Cloud Run (Production)

```
┌────────────────────────────────────────────────────────────┐
│  Cloud Run Service: chatkit-app                            │
│  Region: us-central1                                        │
│  Memory: 2Gi, CPU: 1 vCPU                                  │
│  Scaling: 0-10 instances                                   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Container (from Cloud Build)                       │   │
│  │                                                     │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │  Xvfb :99                                     │  │   │
│  │  │  (No VNC - production mode)                   │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                     │                               │   │
│  │                     ▼                               │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │  Chromium (headless with virtual display)    │  │   │
│  │  │  DISPLAY=:99                                  │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                     │                               │   │
│  │                     ▼                               │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │  Next.js Production Server (port 8080)       │  │   │
│  │  │  - npm start                                  │  │   │
│  │  │  - Optimized build                            │  │   │
│  │  │  - Static asset serving                       │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  │  Environment Variables (from Secret Manager):      │   │
│  │  - OPENAI_API_KEY                                  │   │
│  │  - TWILIO_ACCOUNT_SID                              │   │
│  │  - TWILIO_API_KEY_SID                              │   │
│  │  - TWILIO_API_KEY_SECRET                           │   │
│  │  - TWILIO_PHONE_NUMBER                             │   │
│  │                                                     │   │
│  │  Build-time Variables:                              │   │
│  │  - NEXT_PUBLIC_WORKFLOW_ID                 │   │
│  │  - NEXT_PUBLIC_CHATKIT_DOMAIN_KEY                  │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────┬─────────────────────────────┘
                               │ HTTPS
                               ▼
                   ┌───────────────────────┐
                   │  Cloud Load Balancer  │
                   │  - SSL/TLS            │
                   │  - Auto-scaling       │
                   └───────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
    ┌──────────────────┐              ┌──────────────────┐
    │  Twilio Webhook  │              │  Web Browser     │
    │  (SMS messages)  │              │  (UI testing)    │
    └──────────────────┘              └──────────────────┘
```

**Build & Deploy Flow**:

```
1. Code push to GitHub
   └─> Trigger Cloud Build
       └─> Build Docker image
           ├─ Install dependencies
           ├─ Build Next.js app (with NEXT_PUBLIC_ vars)
           └─ Create container image
       └─> Push to Container Registry
       └─> Deploy to Cloud Run
           ├─ Set runtime env vars
           ├─ Configure scaling
           └─> Create new revision
```

**Features**:

- **Auto-scaling**: 0 to 10 instances based on load
- **Cold start optimization**: ~5-10 seconds
- **SSL/TLS**: Automatic HTTPS
- **Custom domain support**: Map your domain
- **Monitoring**: Cloud Logging & Monitoring
- **Cost optimization**: Pay only for usage

---

## Technology Integration Details

### OpenAI ChatKit Integration

**Purpose**: Provides conversational AI UI as a web component

**Integration Points**:

1. **Web Component**: `<openai-chatkit>` tag in HTML
2. **Session Creation**: Server-side API call to create client tokens
3. **Domain Authentication**: Uses domain keys for security
4. **Event System**: Custom events for programmatic control

**Code Example**:

```typescript
// components/ChatKitPanel.tsx
<ChatKit
  domainKey={DOMAIN_KEY}
  control={chatkit.control}
  className="block flex-1 w-full"
/>

// hooks/useChatKit
const chatkit = useChatKit({
  api: { getClientSecret },
  theme: { colorScheme: 'light' },
  onResponseEnd: handleResponse,
});
```

### Twilio Integration

**Purpose**: SMS messaging infrastructure

**Integration Points**:

1. **Inbound Webhook**: `/api/sms-webhook` receives POST requests
2. **Outbound API**: `/api/send-sms` uses Twilio REST API
3. **Signature Validation**: Verifies requests are from Twilio

**Security**:

```typescript
// Validate Twilio signature
const twilioSignature = request.headers.get("X-Twilio-Signature");
const isValid = validateRequest(
  authToken,
  twilioSignature,
  webhookUrl,
  requestBody
);
```

### Puppeteer Integration

**Purpose**: Browser automation for ChatKit rendering

**Key Features**:

- Headless Chromium control
- Network interception (SSE capture)
- Custom event injection
- Screenshot capabilities
- Session management

**Configuration**:

```typescript
const browser = await puppeteer.launch({
  headless: false, // Needs display for ChatKit
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  env: {
    DISPLAY: ":99", // Use Xvfb virtual display
  },
});
```

### Xvfb Integration

**Purpose**: Virtual X server for headless browser automation

**Why Needed**: ChatKit requires a rendering context, but servers don't have displays

**How It Works**:

1. Xvfb creates virtual display `:99`
2. Set `DISPLAY=:99` environment variable
3. Chromium renders to virtual display
4. No actual monitor needed

**Startup**:

```bash
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
```

---

## Security Architecture

### Authentication Layers

1. **Twilio → Webhook**:
   - Signature validation (HMAC-SHA1)
   - Request origin verification

2. **Client → OpenAI**:
   - Domain key authentication
   - Domain allowlist verification

3. **Server → OpenAI**:
   - API key authentication (Bearer token)
   - Organization/project verification

### Data Protection

- **Secrets Management**: Environment variables, not hardcoded
- **HTTPS Only**: All external communication encrypted
- **Rate Limiting**: 10 requests/hour per phone number
- **Input Validation**: Message length, format checks
- **Session Isolation**: Separate browser instances per user

### Deployment Security

- **Non-root User**: Container runs as `appuser`
- **Minimal Attack Surface**: Only necessary ports exposed
- **Regular Updates**: Dependency scanning and updates
- **Log Sanitization**: No secrets in logs

---

## Performance Characteristics

### Response Times

| Scenario               | Time   | Notes                         |
| ---------------------- | ------ | ----------------------------- |
| First SMS (cold start) | 30-60s | Browser launch + ChatKit init |
| Subsequent SMS (warm)  | 5-15s  | Reuse existing session        |
| ChatKit response       | 2-10s  | Depends on AI model           |
| Twilio SMS delivery    | 1-3s   | Network dependent             |

### Resource Usage

| Component         | Memory     | CPU    | Notes                  |
| ----------------- | ---------- | ------ | ---------------------- |
| Next.js App       | ~200MB     | Low    | Idle state             |
| Chromium Instance | ~200-300MB | Medium | Per session            |
| Xvfb              | ~50MB      | Low    | Shared across browsers |
| Total (1 session) | ~450-550MB | Medium |                        |
| Max (10 sessions) | ~2.5GB     | High   | Cloud Run limit        |

### Scaling Limits

- **Cloud Run**: Max 10 concurrent instances
- **Browser Sessions**: 1 per phone number, 30min timeout
- **Rate Limits**: 10 SMS/hour per number
- **Message Size**: 1600 chars per SMS

---

## Monitoring & Debugging

### Logs

**Location**: Cloud Logging (GCP) or stdout (local)

**Key Log Markers**:

```
[sms-webhook] Incoming SMS from +1234567890
[browserless] Creating new browser session
[ChatKitPanel] ✅ SMS successfully injected
[SSE Intercept] 📝 Response captured
[send-sms] ✅ SMS sent successfully
```

### VNC Debugging

**Access**:

```bash
# Local development
docker-compose -f docker-compose.virtual-display.yml up -d
# Connect via VNC client to localhost:5900
```

**Use Cases**:

- Watch ChatKit UI render in real-time
- Debug CSS/layout issues
- Verify message injection
- Screenshot capture

### Health Checks

**Endpoints**:

- `GET /api/health` - App health status
- `GET /api/sms-webhook` - Active session count

---

## Future Architecture Enhancements

### Planned Improvements

1. **Redis Session Store**:
   - Persist sessions across container restarts
   - Enable horizontal scaling
   - Share sessions between instances

2. **Message Queue**:
   - Decouple SMS reception from processing
   - Handle traffic spikes
   - Retry failed messages

3. **CDN Integration**:
   - Cache static assets
   - Reduce load time
   - Global distribution

4. **Metrics Dashboard**:
   - Real-time monitoring
   - Usage analytics
   - Error tracking

5. **Multi-Region Deployment**:
   - Reduce latency
   - Improve availability
   - Geographic redundancy

---

## Conclusion

Msg2AgentBuilder's architecture balances simplicity with scalability, using proven technologies (Next.js, Puppeteer, Cloud Run) to create a robust SMS-to-AI bridge. The modular design allows for easy extension and maintenance, while the containerized deployment ensures consistency across environments.

For deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).
For Twilio integration details, see [TWILIO_INTEGRATION.md](./TWILIO_INTEGRATION.md).
