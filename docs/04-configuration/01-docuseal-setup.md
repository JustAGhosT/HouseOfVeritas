# DocuSeal Configuration - House of Veritas

## Overview

DocuSeal is the document signing platform for House of Veritas, accessible at `sign.nexamesh.ai`.

## Initial Setup

### 1. First Login

After deployment, access DocuSeal at your configured URL and create the admin account:

- **Email:** <hans@nexamesh.ai>
- **Name:** Hans (Owner)
- **Role:** Admin

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

Upload the House of Veritas logo and configure colors:

- **Primary Color:** #1E40AF (Blue)
- **Secondary Color:** #059669 (Green)
- **Logo:** Use `/public/hv-logo.svg`

### 4. API Key Generation

Navigate to Settings → API and generate an API key. Store this in Azure Key Vault.

### 5. Environment Variables (Next.js / local dev)

Add to `.env.local` (create from `.env.example`):

| Variable           | Description                                           | Example                    |
| ------------------ | ----------------------------------------------------- | -------------------------- |
| `DOCUSEAL_API_URL` | DocuSeal API base URL                                 | `https://api.docuseal.com` |
| `DOCUSEAL_API_KEY` | API key (X-Auth-Token); the token from Settings → API | _(your generated key)_     |

- **DocuSeal Cloud:** Use `https://api.docuseal.com` as base URL; the API key is the token.
- **Self-hosted:** Use `https://sign.nexamesh.ai/api` (or your instance URL + `/api`).

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

Create the following user accounts:

| User  | Email               | Role     |
| ----- | ------------------- | -------- |
| Hans  | <hans@nexamesh.ai>  | Admin    |
| Charl | <charl@nexamesh.ai> | Employee |
| Lucky | <lucky@nexamesh.ai> | Employee |
| Irma  | <irma@nexamesh.ai>  | Resident |

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

- [ ] Admin can log in
- [ ] SMTP sends test email
- [ ] All 18 templates uploaded
- [ ] All 4 users can log in
- [ ] Signature workflow works end-to-end
- [ ] Webhook triggers Azure Function
- [ ] API key works for programmatic access
