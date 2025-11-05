# Public Access Configuration for Cloud Run

## Overview

Twilio webhooks require **public access** to your Cloud Run service. However, some Google Cloud organizations have security policies that restrict public IAM bindings.

## The Issue

When deploying to Cloud Run, you may encounter this error when trying to enable public access:

```
ERROR: FAILED_PRECONDITION: One or more users named in the policy do not belong to a permitted customer, perhaps due to an organization policy.
```

This is caused by the `iam.allowedPolicyMemberDomains` organization policy constraint.

## Current Deployment Status

✅ **Service Deployed**: https://chatkit-app-g5fffzniaq-uc.a.run.app
✅ **Service Health**: Running
⚠️  **Public Access**: Restricted (authorized users only)

**Authorized Users:**
- bart@rethink-labs.com
- greg@rethink-labs.com

## Solutions

### Option 1: Remove Organization Policy Constraint (Requires Org Admin)

An organization administrator needs to modify the organization-level policy:

```bash
# List all org policies
gcloud resource-manager org-policies list --organization=YOUR_ORG_ID

# Check current policy
gcloud resource-manager org-policies describe iam.allowedPolicyMemberDomains \
  --organization=YOUR_ORG_ID

# Option A: Delete the constraint entirely (allows public access)
gcloud resource-manager org-policies delete iam.allowedPolicyMemberDomains \
  --organization=YOUR_ORG_ID

# Option B: Modify to allow 'allUsers'
# Create a policy.yaml file:
# constraint: constraints/iam.allowedPolicyMemberDomains
# listPolicy:
#   allowedValues:
#     - C0xxxxxxx  # Your organization's customer ID
#     - allUsers   # Allow public access

gcloud resource-manager org-policies set-policy policy.yaml \
  --organization=YOUR_ORG_ID
```

### Option 2: Use Cloud Run Invoker Service Account (Alternative)

If organization policies cannot be changed, use a service account for Twilio:

1. **Create a service account for Twilio:**

```bash
# Create service account
gcloud iam service-accounts create twilio-webhook-invoker \
  --display-name="Twilio Webhook Invoker" \
  --project=msg2agentbuilder

# Grant it Cloud Run Invoker role
gcloud run services add-iam-policy-binding chatkit-app \
  --region=us-central1 \
  --member="serviceAccount:twilio-webhook-invoker@msg2agentbuilder.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=msg2agentbuilder

# Create a key for the service account
gcloud iam service-accounts keys create twilio-key.json \
  --iam-account=twilio-webhook-invoker@msg2agentbuilder.iam.gserviceaccount.com
```

2. **Configure authenticated requests:**

This approach requires adding authentication headers to Twilio webhook requests, which is complex and not recommended for Twilio integration.

### Option 3: Deploy to a Different Project Without Org Policies

Create a new GCP project outside your organization's policy constraints:

```bash
# Create new project
gcloud projects create msg2agentbuilder-public --name="Msg2AgentBuilder Public"

# Set billing account
gcloud billing projects link msg2agentbuilder-public --billing-account=BILLING_ACCOUNT_ID

# Re-deploy to the new project
# Update .env.local:
# GCP_PROJECT_ID=msg2agentbuilder-public

./scripts/deploy-cloudrun-virtual-display.sh
```

### Option 4: Use Cloud Run with --allow-unauthenticated Flag During Deployment

Modify the deployment script to include the `--allow-unauthenticated` flag at deployment time (this sometimes bypasses the IAM policy restriction):

Already included in deployment script at line 98:
```bash
--allow-unauthenticated \
```

However, this still requires the organization policy to permit it.

## Recommended Solution

**For production Twilio integration**, we recommend **Option 1** - have your organization administrator modify the organization policy to allow public access for this specific project or service.

**Contact**: greg@rethink-labs.com (Organization Administrator)

## Verification After Fix

Once public access is granted, verify with:

```bash
# Test public access (no authentication)
curl https://chatkit-app-g5fffzniaq-uc.a.run.app/api/health

# Expected response:
# {"mode":"browserless-chatkit","activeSessions":0,"sessions":[]}
```

## Configure Twilio Webhook

After public access is enabled:

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Select your phone number
3. Under "Messaging Configuration" → "A MESSAGE COMES IN":
   - **Webhook URL**: `https://chatkit-app-g5fffzniaq-uc.a.run.app/api/sms-webhook`
   - **HTTP Method**: `POST`
4. Click "Save"

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
gcloud run services get-iam-policy chatkit-app \
  --region=us-central1 \
  --project=msg2agentbuilder
```

### Check Organization Policies

```bash
# At project level
gcloud resource-manager org-policies describe iam.allowedPolicyMemberDomains \
  --project=msg2agentbuilder

# At organization level (requires org admin)
gcloud resource-manager org-policies describe iam.allowedPolicyMemberDomains \
  --organization=YOUR_ORG_ID
```

### Manually Grant Public Access

```bash
./scripts/allow-public-cloudrun.sh
```

## Related Documentation

- [Google Cloud Run IAM](https://cloud.google.com/run/docs/authenticating/public)
- [Organization Policy Constraints](https://cloud.google.com/resource-manager/docs/organization-policy/org-policy-constraints)
- [Twilio Webhook Security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)

---

**Last Updated**: 2025-11-04
**Service URL**: https://chatkit-app-g5fffzniaq-uc.a.run.app
**Status**: Deployed, awaiting public access configuration
