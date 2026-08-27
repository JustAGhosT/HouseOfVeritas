# DocuSeal Configuration - House of Veritas

## Overview

DocuSeal at `sign.nexamesh.ai` is deployed independently of HOV. CoilTrace has implemented an integration with this endpoint but remains pre-launch, and HOV is a separate prospective consumer. [ADR-014](../02-architecture/14-nexamesh-product-boundary-adr.md) leaves final shared-service ownership unresolved, so HOV must not treat the instance, global administrator, or instance-level branding as HOV-owned.

## Initial Setup

### 1. First Login

Initial `/setup` creates the instance's global administrator. The service owner, once confirmed, must control that identity and its recovery material. HOV product participants should receive only the least privilege needed for HOV templates and submissions, not the global administrator login.

### 2. SMTP Configuration

Navigate to Settings → Email and configure:

```text
SMTP Server: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [Your SendGrid API Key]
From: noreply@nexamesh.ai
```

### 3. Branding

Do not change instance-level branding on HOV's behalf while service ownership remains unresolved. Keep product identity in each template:

- CoilTrace certificate templates use CoilTrace identity.
- HOV governance templates use HOV identity.
- New product integrations should include a lowercase `product` key in submission metadata so shared-service routing can remain product-scoped. CoilTrace already sends this key; HOV must add and test it before relying on metadata-based routing.

### 4. API Key Generation

Navigate to Settings → API and generate an API key. Store this in Azure Key Vault.

### 5. Environment Variables (Next.js / local dev)

Add to `.env.local` (create from `.env.example`):

| Variable           | Description                                           | Example                    |
| ------------------ | ----------------------------------------------------- | -------------------------- |
| `DOCUSEAL_API_URL` | DocuSeal API base URL                                 | `https://api.docuseal.com` |
| `DOCUSEAL_API_KEY` | API key (X-Auth-Token); the token from Settings → API | _(your generated key)_     |

- **DocuSeal Cloud:** Use `https://api.docuseal.com` as base URL; the API key is the token.
- **Self-hosted:** Use `https://sign.nexamesh.ai/api`. The confirmed service owner must provision a separate, least-privilege credential per product and environment before HOV is enabled.

## Document Templates

Upload the 18 governance documents as templates. See `/config/templates/` for the list.

### Template Categories

| #   | Document                     | Type       | Signers         |
| --- | ---------------------------- | ---------- | --------------- |
| 1   | Property Charter             | Governance | Hans            |
| 2   | House Rules                  | Governance | All             |
| 3   | Workshop Safety Manual       | Safety     | Charl, Lucky    |
| 4   | Employment Contract          | HR         | Employee + Hans |
| 5   | Resident Agreement           | Governance | Irma + Hans     |
| 6   | Vehicle Usage Policy         | Operations | Charl, Lucky    |
| 7   | Tool Checkout Policy         | Operations | Charl, Lucky    |
| 8   | Expense Reimbursement Policy | Finance    | All             |
| 9   | Leave Policy                 | HR         | All             |
| 10  | Overtime Policy              | HR         | Charl, Lucky    |
| 11  | Incident Reporting Procedure | Safety     | All             |
| 12  | Emergency Contact List       | Safety     | All             |
| 13  | Asset Maintenance Schedule   | Operations | Charl           |
| 14  | Garden Maintenance Plan      | Operations | Lucky           |
| 15  | Household Task Roster        | Operations | Irma            |
| 16  | Financial Approval Matrix    | Finance    | Hans            |
| 17  | POPIA Consent Form           | Compliance | All             |
| 18  | Succession Protocol          | Governance | Hans            |

## User Accounts

These are HOV product participants, not shared-service administrators. Prefer DocuSeal submitter identities unless a user genuinely needs HOV template-management access:

| User  | Email               | DocuSeal access                                      |
| ----- | ------------------- | ---------------------------------------------------- |
| Hans  | <hans@nexamesh.ai>  | HOV template manager, only if operationally required |
| Charl | <charl@nexamesh.ai> | Submission recipient                                 |
| Lucky | <lucky@nexamesh.ai> | Submission recipient                                 |
| Irma  | <irma@nexamesh.ai>  | Submission recipient                                 |

## Webhook Configuration

Register webhook for integration with Baserow:

- **URL:** `https://func-houseofveritas.azurewebsites.net/api/docuseal-webhook`
- **Events:** `submission.completed`, `submission.viewed`
- **Secret:** Store in Key Vault

## API Endpoints

Base URL: `https://sign.nexamesh.ai/api`

| Endpoint               | Method | Description              |
| ---------------------- | ------ | ------------------------ |
| `/api/templates`       | GET    | List all templates       |
| `/api/templates`       | POST   | Create template          |
| `/api/submissions`     | POST   | Create signature request |
| `/api/submissions/:id` | GET    | Get submission status    |
| `/api/webhooks`        | POST   | Register webhook         |

## Testing Checklist

- [ ] Required HOV template manager can log in, if configured
- [ ] SMTP sends test email
- [ ] All 18 templates uploaded
- [ ] Submission recipients can complete the signing workflow
- [ ] Signature workflow works end-to-end
- [ ] Webhook triggers Azure Function
- [ ] API key works for programmatic access
