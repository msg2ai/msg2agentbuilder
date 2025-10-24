#!/bin/bash

# Cloud Run deployment script for OpenAI ChatKit Starter App
# This script deploys the application to Google Cloud Run

set -e

# Configuration
PROJECT_ID="eliza-447106"
SERVICE_NAME="chatkit-app"
REGION="us-central1"
MIN_INSTANCES=0  # Scale to zero when no traffic (cost savings)
MAX_INSTANCES=10
MEMORY="2Gi"
CPU=1

echo "Deploying to Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable run.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID
gcloud services enable artifactregistry.googleapis.com --project=$PROJECT_ID

# Check for required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY not set"
  echo "Please set it: export OPENAI_API_KEY=your-key"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_WORKFLOW_ID" ]; then
  echo "Error: NEXT_PUBLIC_WORKFLOW_ID not set"
  echo "Please set it: export NEXT_PUBLIC_WORKFLOW_ID=your-workflow-id"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY" ]; then
  echo "Error: NEXT_PUBLIC_CHATKIT_DOMAIN_KEY not set"
  echo "Please set it: export NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=your-domain-key"
  exit 1
fi

if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ] || [ -z "$TWILIO_PHONE_NUMBER" ]; then
  echo "Warning: Twilio credentials not set. SMS functionality will not work."
  echo "Set them with: export TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=..."
fi

# Deploy to Cloud Run
echo ""
echo "Building and deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --min-instances $MIN_INSTANCES \
  --max-instances $MAX_INSTANCES \
  --memory $MEMORY \
  --cpu $CPU \
  --port 8080 \
  --timeout 300 \
  --set-build-env-vars "NEXT_PUBLIC_WORKFLOW_ID=$NEXT_PUBLIC_WORKFLOW_ID,NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY" \
  --set-env-vars "NODE_ENV=production,OPENAI_API_KEY=$OPENAI_API_KEY,NEXT_PUBLIC_WORKFLOW_ID=$NEXT_PUBLIC_WORKFLOW_ID,NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY,TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN,TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --format 'value(status.url)')

echo ""
echo "============================================"
echo "Deployment successful!"
echo "Service URL: $SERVICE_URL"
echo "============================================"
echo ""
echo "To view logs:"
echo "  gcloud run logs tail --service=$SERVICE_NAME --project=$PROJECT_ID"
echo ""
echo "To update environment variables:"
echo "  gcloud run services update $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --set-env-vars KEY=VALUE"
