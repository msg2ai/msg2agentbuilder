#!/bin/bash

# Script to grant public access to Cloud Run service
# Required for Twilio webhook integration

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

echo "=========================================="
echo "Granting Public Access to Cloud Run"
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

# Check if organization policy is blocking public access
echo "Checking organization policies..."
ORG_POLICY_CHECK=$(gcloud resource-manager org-policies describe iam.allowedPolicyMemberDomains --project=$PROJECT_ID 2>&1 || true)

if echo "$ORG_POLICY_CHECK" | grep -q "allowedValues"; then
  echo "⚠️  WARNING: Organization policy 'iam.allowedPolicyMemberDomains' is restricting IAM members."
  echo ""
  echo "To allow public access, you need to either:"
  echo "  1. Delete the project-level policy:"
  echo "     gcloud resource-manager org-policies delete iam.allowedPolicyMemberDomains --project=$PROJECT_ID"
  echo ""
  echo "  2. Or contact your organization admin to modify the organization-level policy"
  echo ""
  echo "Attempting to grant public access anyway..."
  echo ""
fi

# Try to add allUsers binding
echo "Adding allUsers to IAM policy..."
if gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --region=$REGION \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project=$PROJECT_ID 2>&1; then

  echo ""
  echo "✅ SUCCESS! Public access granted."
  echo ""

  # Get service URL
  SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --project $PROJECT_ID \
    --format 'value(status.url)')

  echo "Service URL: $SERVICE_URL"
  echo ""
  echo "You can now configure your Twilio webhook:"
  echo "  SMS Webhook URL: $SERVICE_URL/api/sms-webhook"
  echo ""
  echo "Test the service:"
  echo "  curl $SERVICE_URL/api/health"
  echo ""

else
  echo ""
  echo "❌ FAILED to grant public access."
  echo ""
  echo "This is likely due to an organization policy restriction."
  echo ""
  echo "Current IAM policy:"
  gcloud run services get-iam-policy $SERVICE_NAME --region=$REGION --project=$PROJECT_ID
  echo ""
  echo "Next steps:"
  echo "  1. Contact your GCP organization administrator"
  echo "  2. Request removal or modification of 'iam.allowedPolicyMemberDomains' constraint"
  echo "  3. Alternatively, add specific users to the IAM policy:"
  echo "     gcloud run services add-iam-policy-binding $SERVICE_NAME \\"
  echo "       --region=$REGION \\"
  echo "       --member='user:your-email@example.com' \\"
  echo "       --role='roles/run.invoker' \\"
  echo "       --project=$PROJECT_ID"
  echo ""
  exit 1
fi
