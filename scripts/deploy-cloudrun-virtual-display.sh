#!/bin/bash

# Cloud Run deployment script for OpenAI ChatKit with Virtual Display Support
# This deploys the Xvfb/virtual display version (no VNC access in production)

set -e

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
  echo "Loading configuration from .env.local..."
  export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
fi

# Configuration (with defaults)
# For virtual display, default to chatkit-virtual-display service name
PROJECT_ID="${GCP_PROJECT_ID}"
SERVICE_NAME="${GCP_SERVICE_NAME:-chatkit-virtual-display}"
REGION="${GCP_REGION:-us-central1}"
MIN_INSTANCES="${GCP_MIN_INSTANCES:-0}"
MAX_INSTANCES="${GCP_MAX_INSTANCES:-10}"
MEMORY="${GCP_MEMORY:-2Gi}"
CPU="${GCP_CPU:-1}"

echo "=========================================="
echo "Cloud Run Virtual Display Deployment"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Validate required configuration
if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID not set"
  echo "Please set it in .env.local or: export GCP_PROJECT_ID=your-project-id"
  exit 1
fi

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

if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_API_KEY_SID" ] || [ -z "$TWILIO_API_KEY_SECRET" ] || [ -z "$TWILIO_PHONE_NUMBER" ]; then
  echo "Warning: Twilio credentials not set. SMS functionality will not work."
  echo "Set them in .env.local:"
  echo "  TWILIO_ACCOUNT_SID=..."
  echo "  TWILIO_API_KEY_SID=..."
  echo "  TWILIO_API_KEY_SECRET=..."
  echo "  TWILIO_PHONE_NUMBER=..."
fi

# Build Docker image using virtual display Dockerfile
echo ""
echo "Building Docker image with virtual display support..."
echo "Using Dockerfile: Dockerfile.virtual-display"

# Build for Cloud Run (requires linux/amd64 platform)
# Note: Only passing public Next.js variables as build args (safe to bake into image)
# Sensitive secrets like OPENAI_API_KEY are passed at runtime instead
docker build \
  --platform linux/amd64 \
  -f Dockerfile.virtual-display \
  --build-arg NEXT_PUBLIC_WORKFLOW_ID=$NEXT_PUBLIC_WORKFLOW_ID \
  --build-arg NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY \
  -t gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  .

echo ""
echo "Pushing image to Google Container Registry..."
docker push gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --min-instances $MIN_INSTANCES \
  --max-instances $MAX_INSTANCES \
  --memory $MEMORY \
  --cpu $CPU \
  --port 3000 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,DISPLAY=:99,VIRTUAL_DISPLAY=true,BROWSER_VISIBLE=true,OPENAI_API_KEY=$OPENAI_API_KEY,NEXT_PUBLIC_WORKFLOW_ID=$NEXT_PUBLIC_WORKFLOW_ID,NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=$NEXT_PUBLIC_CHATKIT_DOMAIN_KEY,TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID,TWILIO_API_KEY_SID=$TWILIO_API_KEY_SID,TWILIO_API_KEY_SECRET=$TWILIO_API_KEY_SECRET,TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER,DISABLE_OCR_FALLBACK=${DISABLE_OCR_FALLBACK:-true}"

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --format 'value(status.url)')

echo ""
echo "============================================"
echo "Deployment successful!"
echo "============================================"
echo "Service URL: $SERVICE_URL"
echo ""
echo "IMPORTANT NOTES:"
echo "- Virtual display (Xvfb) is running inside containers"
echo "- Browsers run in non-headless mode on virtual display"
echo "- VNC is NOT exposed (no remote viewing in Cloud Run)"
echo "- Use screenshot capture for monitoring"
echo ""
echo "Test the deployment:"
echo "  curl $SERVICE_URL/api/health"
echo ""
echo "View logs:"
echo "  gcloud run logs tail --service=$SERVICE_NAME --project=$PROJECT_ID"
echo ""
echo "Update environment variables:"
echo "  gcloud run services update $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --set-env-vars KEY=VALUE"
echo ""
echo "Configure Twilio webhook:"
echo "  SMS Webhook URL: $SERVICE_URL/api/sms-webhook"
echo ""
