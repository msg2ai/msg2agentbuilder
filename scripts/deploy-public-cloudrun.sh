#!/bin/bash

# Complete Cloud Run deployment script with public access enabled
# This script handles organization policy setup and deployment in one go

set -e

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
  echo "Loading configuration from .env.local..."
  export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
fi

# Configuration
PROJECT_ID="${GCP_PROJECT_ID}"
SERVICE_NAME="${GCP_SERVICE_NAME:-chatkit-app}"
REGION="${GCP_REGION:-us-central1}"
IMAGE_NAME="${SERVICE_NAME}"

echo "=========================================="
echo "Cloud Run Public Deployment"
echo "=========================================="
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Validate required configuration
if [ -z "$PROJECT_ID" ]; then
  echo "Error: GCP_PROJECT_ID not set"
  echo "Please set it in .env.local"
  exit 1
fi

# Get organization ID
ORG_ID=$(gcloud projects describe $PROJECT_ID --format='value(parent.id)')
echo "Organization ID: $ORG_ID"
echo ""

# Step 1: Update organization policy to allow public access
echo "Step 1: Updating organization policy..."
echo ""

# Create policy file
cat > /tmp/org-policy-allow-public.yaml <<EOF
constraint: constraints/iam.allowedPolicyMemberDomains
listPolicy:
  allValues: ALLOW
EOF

# Apply organization policy
echo "Applying organization policy to allow all IAM members..."
gcloud resource-manager org-policies set-policy /tmp/org-policy-allow-public.yaml \
  --organization=$ORG_ID

echo "✅ Organization policy updated"
echo ""

# Step 2: Build and deploy
echo "Step 2: Building and deploying to Cloud Run..."
echo ""

# Get the latest image
IMAGE="gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"

# Deploy with public access
echo "Deploying $IMAGE..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --project=$PROJECT_ID \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars="OPENAI_API_KEY=${OPENAI_API_KEY},NEXT_PUBLIC_WORKFLOW_ID=${NEXT_PUBLIC_WORKFLOW_ID},NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=${NEXT_PUBLIC_CHATKIT_DOMAIN_KEY},TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID},TWILIO_API_KEY_SID=${TWILIO_API_KEY_SID},TWILIO_API_KEY_SECRET=${TWILIO_API_KEY_SECRET},TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER},DISABLE_OCR_FALLBACK=${DISABLE_OCR_FALLBACK:-true}"

echo ""
echo "✅ Deployment complete!"
echo ""

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --format 'value(status.url)')

echo "=========================================="
echo "Deployment Summary"
echo "=========================================="
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Public access: ✅ ENABLED"
echo ""
echo "Test health endpoint:"
echo "  curl $SERVICE_URL/api/health"
echo ""
echo "Configure Twilio webhook:"
echo "  Webhook URL: $SERVICE_URL/api/sms-webhook"
echo "  HTTP Method: POST"
echo ""
echo "View logs:"
echo "  gcloud run logs tail --service=$SERVICE_NAME --project=$PROJECT_ID"
echo ""
echo "=========================================="
