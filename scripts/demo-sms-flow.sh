#!/bin/bash

# Complete SMS Flow Demo
# This demonstrates the full cycle: SMS in → ChatKit → AI Response → SMS out

echo "╔════════════════════════════════════════╗"
echo "║   SMS → ChatKit Integration Demo      ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PORT=${PORT:-3005}

echo -e "${BLUE}Step 1: Sending SMS to webhook${NC}"
echo "From: +15551234567"
echo "Message: What is the capital of France?"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:${PORT}/api/sms-webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+15551234567&Body=What is the capital of France?")

echo -e "${GREEN}✓ SMS received by webhook${NC}"
echo "Response: $RESPONSE"
echo ""

echo -e "${BLUE}Step 2: Checking pending SMS messages${NC}"
sleep 1

PENDING=$(curl -s http://localhost:${PORT}/api/sms-webhook)
echo "$PENDING" | jq .
echo ""

echo -e "${YELLOW}Step 3: Waiting for ChatKit to poll and process...${NC}"
echo "(Frontend polls every 5 seconds)"
echo ""
echo "What should happen:"
echo "  1. Frontend polls /api/sms-webhook"
echo "  2. Finds the SMS message"
echo "  3. Injects it into ChatKit UI using chatkit.control.sendMessage()"
echo "  4. Workflow processes the message"
echo "  5. AI responds"
echo "  6. onResponseEnd sends SMS back via /api/send-sms"
echo ""

echo -e "${GREEN}✓ Demo complete!${NC}"
echo ""
echo "To see it in action:"
echo "  1. Open http://localhost:${PORT} in your browser"
echo "  2. Watch the browser console for logs"
echo "  3. Watch the server console (terminal) for SMS logs"
echo "  4. Run this script to send test SMS"
echo ""
echo "To send another SMS:"
echo "  ./demo-sms-flow.sh"
