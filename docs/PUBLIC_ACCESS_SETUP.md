# Public Access Configuration for Cloud Run

## Overview

Twilio webhooks require **public access** to your Cloud Run service. However, some Google Cloud organizations have security policies that restrict public IAM bindings.

## The Issue

When deploying to Cloud Run, you may encounter this error when trying to enable public access:

```
ERROR: FAILED_PRECONDITION: One or more users named in the policy do not belong to a permitted customer, perhaps due to an organization policy.
```

This is caused by the `iam.allowedPolicyMemberDomains` organization policy constraint.

## ✅ Successful Solution

The following steps successfully enabled public access:

### Step 1: Update Organization Policy

Create policy file `scripts/org-policy-allow-public.yaml`:
```yaml
constraint: constraints/iam.allowedPolicyMemberDomains
listPolicy:
  allValues: ALLOW
```

Apply the policy:
```bash
# Get your organization ID
ORG_ID=$(gcloud projects describe YOUR_PROJECT_ID --format='value(parent.id)')

# Apply the policy
gcloud resource-manager org-policies set-policy scripts/org-policy-allow-public.yaml \
  --organization=$ORG_ID
```

### Step 2: Redeploy with --allow-unauthenticated

```bash
gcloud run deploy YOUR_SERVICE_NAME \
  --region=YOUR_REGION \
  --project=YOUR_PROJECT_ID \
  --allow-unauthenticated \
  --image=gcr.io/YOUR_PROJECT_ID/YOUR_SERVICE_NAME:latest
```

**Key Insight**: Using `gcloud run deploy` with `--allow-unauthenticated` during deployment worked where `gcloud run services add-iam-policy-binding` failed, even after updating the org policy.

### Step 3: Verify Public Access

```bash
# Test health endpoint (replace with your actual service URL)
curl https://YOUR-SERVICE-URL.run.app/api/health

# Expected response:
# {"status":"ok","timestamp":"...","service":"msg2agentbuilder"}

# Test SMS webhook endpoint
curl https://YOUR-SERVICE-URL.run.app/api/sms-webhook

# Expected response:
# {"mode":"browserless-chatkit","activeSessions":0,"sessions":[]}
```

---

## Alternative Solutions

### Option 1: Remove Organization Policy Constraint (Requires Org Admin)

An organization administrator can modify the organization-level policy:

```bash
# List all org policies
gcloud resource-manager org-policies list --organization=YOUR_ORG_ID

# Check current policy
gcloud resource-manager org-policies describe iam.allowedPolicyMemberDomains \
  --organization=YOUR_ORG_ID

# Option A: Delete the constraint entirely (allows public access)
gcloud resource-manager org-policies delete iam.allowedPolicyMemberDomains \
  --organization=YOUR_ORG_ID

# Option B: Modify to allow specific values
# Create a policy.yaml file:
# constraint: constraints/iam.allowedPolicyMemberDomains
# listPolicy:
#   allowedValues:
#     - C0xxxxxxx  # Your organization's customer ID
#     - C00000000  # Special value for public access

gcloud resource-manager org-policies set-policy policy.yaml \
  --organization=YOUR_ORG_ID
```

### Option 2: Use Cloud Run Invoker Service Account (Not Recommended)

If organization policies cannot be changed, use a service account for Twilio:

```bash
# Create service account
gcloud iam service-accounts create twilio-webhook-invoker \
  --display-name="Twilio Webhook Invoker" \
  --project=YOUR_PROJECT_ID

# Grant it Cloud Run Invoker role
gcloud run services add-iam-policy-binding YOUR_SERVICE_NAME \
  --region=YOUR_REGION \
  --member="serviceAccount:twilio-webhook-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=YOUR_PROJECT_ID
```

**Note:** This approach requires adding authentication headers to Twilio webhook requests, which is complex and not recommended.

### Option 3: Deploy to a Different Project

Create a new GCP project outside your organization's policy constraints:

```bash
# Create new project
gcloud projects create your-new-project-id --name="Your Project Name"

# Set billing account
gcloud billing projects link your-new-project-id --billing-account=BILLING_ACCOUNT_ID

# Update .env.local with new project ID and redeploy
```

## Recommended Solution

**For production Twilio integration**, we recommend using the **Successful Solution** above - update your organization policy to `allValues: ALLOW` and redeploy with `--allow-unauthenticated`.

Contact your organization administrator if you need help modifying org policies.

## Configure Twilio Webhook

After public access is enabled:

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Select your phone number
3. Under "Messaging Configuration" → "A MESSAGE COMES IN":
   - **Webhook URL**: `https://YOUR-SERVICE-URL.run.app/api/sms-webhook`
   - **HTTP Method**: `POST`
4. Click "Save"

### Test Your SMS Integration

Send a text message to your Twilio number and you should receive an AI-powered response!

## Notes for Cloud Run vs Local Development

### Cloud Run
- ✅ **Does NOT require ngrok** - Cloud Run provides a public HTTPS URL
- ✅ **Domain key is optional** - You can leave `NEXT_PUBLIC_CHATKIT_DOMAIN_KEY` empty during initial testing
- ✅ **Automatic HTTPS** - Cloud Run handles SSL certificates
- ⚠️  **Requires public access** - Must resolve organization policy issue

### Local Development
- ⚠️  **Requires ngrok** - OpenAI domain allowlist doesn't accept `localhost`
- ⚠️  **Requires domain key** - Must add ngrok domain to OpenAI allowlist
- ⚠️  **URL changes** - Free ngrok URLs change on restart

## Troubleshooting

### Check Current IAM Policy

```bash
gcloud run services get-iam-policy YOUR_SERVICE_NAME \
  --region=YOUR_REGION \
  --project=YOUR_PROJECT_ID
```

Expected output should include:
```yaml
bindings:
- members:
  - allUsers
  role: roles/run.invoker
```

### Check Organization Policies

```bash
# At project level
gcloud resource-manager org-policies describe iam.allowedPolicyMemberDomains \
  --project=YOUR_PROJECT_ID

# At organization level (requires org admin)
gcloud resource-manager org-policies describe iam.allowedPolicyMemberDomains \
  --organization=YOUR_ORG_ID
```

### Verify Public Access

```bash
# Should work without authentication
curl https://YOUR-SERVICE-URL.run.app/api/health

# If you get a 403 error, public access is not enabled
# If you get a 200 response with JSON, public access is working
```

### Manually Grant Public Access (Alternative Method)

Use the provided helper script:

```bash
./scripts/allow-public-cloudrun.sh
```

Or manually add the IAM binding:

```bash
gcloud run services add-iam-policy-binding YOUR_SERVICE_NAME \
  --region=YOUR_REGION \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project=YOUR_PROJECT_ID
```

## Automated Deployment Script

We've created a complete deployment script that handles everything:

```bash
./scripts/deploy-public-cloudrun.sh
```

This script will:
1. Update the organization policy
2. Build and deploy your service
3. Enable public access
4. Display your service URL and configuration instructions

## Related Documentation

- [Google Cloud Run IAM](https://cloud.google.com/run/docs/authenticating/public)
- [Organization Policy Constraints](https://cloud.google.com/resource-manager/docs/organization-policy/org-policy-constraints)
- [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/overview)

---

**Document Version**: 1.1
**Last Updated**: 2025-11-05
**Status**: Complete deployment guide with working solution
