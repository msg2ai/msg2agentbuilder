#!/bin/bash

# Test script for Cloud Run deployed ChatKit SMS flow
# Tests the browserless SMS webhook on the deployed service

set -e

SERVICE_URL="https://chatkit-app-xaggpwlutq-uc.a.run.app"
TEST_PHONE="+15551234567"
TEST_MESSAGE="Tell me a quick joke about AI"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Testing Cloud Run ChatKit SMS Flow                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Service URL: $SERVICE_URL"
echo ""

# Check if service is healthy
echo "1️⃣  Checking service health..."
HEALTH=$(curl -s "$SERVICE_URL/api/health" || echo "Failed")
if [[ "$HEALTH" == *"healthy"* ]] || [[ "$HEALTH" == *"ok"* ]]; then
    echo "   ✅ Service is healthy"
else
    echo "   ⚠️  Health check response: $HEALTH"
fi
echo ""

# Check browser sessions
echo "2️⃣  Checking active browser sessions..."
SESSIONS=$(curl -s "$SERVICE_URL/api/sms-webhook" 2>&1)
echo "   $SESSIONS"
echo ""

# Send test SMS
echo "3️⃣  Sending test SMS to webhook..."
echo "   From: $TEST_PHONE"
echo "   Message: $TEST_MESSAGE"
echo ""

START_TIME=$(date +%s)

echo "   Making request (this may take 30-60 seconds for first request)..."
RESPONSE=$(curl -v -X POST "$SERVICE_URL/api/sms-webhook" \
  --max-time 120 \
  -d "From=$TEST_PHONE" \
  -d "Body=$TEST_MESSAGE" \
  2>&1)

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "Response:"
echo "$RESPONSE"
echo ""
echo "⏱️  Total duration: ${DURATION} seconds"
echo ""

# Check if response contains TwiML (success indicator)
if [[ "$RESPONSE" == *"<Response>"* ]]; then
    echo "✅ SMS webhook responded successfully!"
else
    echo "⚠️  Response may indicate an error"
fi
echo ""

# Check sessions again
echo "4️⃣  Checking browser sessions after request..."
SESSIONS_AFTER=$(curl -s "$SERVICE_URL/api/sms-webhook" 2>&1)
echo "   $SESSIONS_AFTER"
echo ""

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                     Test Complete                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "To view Cloud Run logs:"
echo "  gcloud run logs tail --service=chatkit-app --project=eliza-447106"
echo ""
echo "To cleanup browser sessions:"
echo "  curl -X DELETE $SERVICE_URL/api/sms-webhook"
echo ""
