#!/bin/bash

# Deploy using Cloud Build with explicit cloudbuild.yaml
# This ensures build args are properly passed

set -e

PROJECT_ID="eliza-447106"
REGION="us-central1"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Deploying with Cloud Build (cloudbuild.yaml)          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check for required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY not set"
  exit 1
fi

if [ -z "$TWILIO_ACCOUNT_SID" ]; then
  echo "Error: TWILIO_ACCOUNT_SID not set"
  exit 1
fi

if [ -z "$TWILIO_AUTH_TOKEN" ]; then
  echo "Error: TWILIO_AUTH_TOKEN not set"
  exit 1
fi

if [ -z "$TWILIO_PHONE_NUMBER" ]; then
  echo "Error: TWILIO_PHONE_NUMBER not set"
  exit 1
fi

echo "✅ Environment variables validated"
echo ""
echo "📦 Submitting build to Cloud Build..."
echo "   This will:"
echo "   1. Build Docker image with NEXT_PUBLIC vars as build args"
echo "   2. Push to Container Registry"
echo "   3. Deploy to Cloud Run"
echo ""

gcloud builds submit \
  --config=cloudbuild.yaml \
  --project=$PROJECT_ID \
  --substitutions="_NEXT_PUBLIC_WORKFLOW_ID=${NEXT_PUBLIC_WORKFLOW_ID},_NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=${NEXT_PUBLIC_CHATKIT_DOMAIN_KEY},_OPENAI_API_KEY=${OPENAI_API_KEY},_TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID},_TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN},_TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}" \
  --timeout=30m

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                 Deployment Complete!                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe chatkit-app \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --format 'value(status.url)')

echo "Service URL: $SERVICE_URL"
echo ""
echo "To test SMS:"
echo "  ./test-cloudrun-sms.sh"
echo ""
echo "To view logs:"
echo "  gcloud run services logs read chatkit-app --project=$PROJECT_ID --limit=50"
echo ""
