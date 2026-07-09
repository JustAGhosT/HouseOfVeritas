# Veritas Journey

## Role

Specialized agent that traces each business feature vertically through the entire stack
(UI -> API -> Service -> Database -> Infrastructure -> CI/CD -> Tests) to identify gaps
where a feature is implemented in one layer but missing in another.

## Scope

```text
(entire codebase, cross-cutting)
```

## Method

For each feature, verify presence at EVERY layer:

```text
┌─────────────────┐
│   UI Component   │  - Page, form, button, display
├─────────────────┤
│    API Route     │  - Next.js route handler
├─────────────────┤
│  Service Layer   │  - lib/services/* integration
├─────────────────┤
│  Data/Storage    │  - Baserow table / Blob / PostgreSQL
├─────────────────┤
│  Azure Function  │  - Background processing
├─────────────────┤
│  Infrastructure  │  - Terraform resource
├─────────────────┤
│     Testing      │  - Unit + E2E coverage
├─────────────────┤
│      CI/CD       │  - Deploy pipeline coverage
└─────────────────┘
```

## Features to Trace

### 1. User Authentication

| Layer      | Expected                                        | Status |
| ---------- | ----------------------------------------------- | ------ |
| UI         | Login page, logout button, session indicator    |        |
| API        | /api/auth/login, /api/auth/logout, /api/auth/me |        |
| Service    | JWT signing/verification, password hashing      |        |
| Middleware | Route protection, rate limiting                 |        |
| Data       | User store (in-memory -> future: database)      |        |
| Tests      | Unit (jwt, users, rbac), E2E (login flow)       |        |

### 2. Kiosk Request Submission

| Layer        | Expected                              | Status |
| ------------ | ------------------------------------- | ------ |
| UI           | Kiosk page with request form          |        |
| API          | /api/kiosk (POST)                     |        |
| Service      | MongoDB or Baserow storage            |        |
| Notification | SMS/email to admin on new request     |        |
| Azure Func   | task-sync to create task from request |        |
| Tests        | Unit + E2E                            |        |

### 3. Task Management

| Layer      | Expected                        | Status |
| ---------- | ------------------------------- | ------ |
| UI         | Task list, create/edit/complete |        |
| API        | /api/tasks CRUD                 |        |
| Service    | Baserow tasks table             |        |
| Azure Func | task-sync for automation        |        |
| Tests      | Unit + E2E                      |        |

### 4. Document Management

| Layer      | Expected                             | Status |
| ---------- | ------------------------------------ | ------ |
| UI         | Document list, upload, sign          |        |
| API        | /api/documents CRUD                  |        |
| Service    | DocuSeal API integration             |        |
| Storage    | Azure Blob for originals             |        |
| OCR        | Document Intelligence for extraction |        |
| Azure Func | document-expiry checker              |        |
| Infra      | Cognitive Services, Storage Account  |        |
| Tests      | Unit + E2E                           |        |

### 5. Time & Attendance

| Layer      | Expected                     | Status |
| ---------- | ---------------------------- | ------ |
| UI         | Clock in/out, timesheet view |        |
| API        | /api/time-clock CRUD         |        |
| Service    | Baserow time-clock table     |        |
| Azure Func | time-clock aggregation       |        |
| Tests      | Unit + E2E                   |        |

### 6. Expense Management

| Layer      | Expected                       | Status |
| ---------- | ------------------------------ | ------ |
| UI         | Expense list, submit, approve  |        |
| API        | /api/expenses CRUD             |        |
| Service    | Baserow expenses table         |        |
| Storage    | Blob storage for receipts      |        |
| Azure Func | payroll-calc includes expenses |        |
| Tests      | Unit + E2E                     |        |

### 7. Payroll

| Layer      | Expected                        | Status |
| ---------- | ------------------------------- | ------ |
| UI         | Payroll dashboard, pay stubs    |        |
| API        | /api/payroll                    |        |
| Service    | Calculation logic               |        |
| Azure Func | payroll-calc scheduled function |        |
| Tests      | Unit + E2E                      |        |

### 8. Reporting

| Layer      | Expected                       | Status |
| ---------- | ------------------------------ | ------ |
| UI         | Report selection, view, export |        |
| API        | /api/reports                   |        |
| Service    | Data aggregation from Baserow  |        |
| Azure Func | report-gen scheduled function  |        |
| Tests      | Unit + E2E                     |        |

### 9. Notifications (SMS/Email)

| Layer      | Expected                          | Status |
| ---------- | --------------------------------- | ------ |
| UI         | Notification preferences, history |        |
| API        | /api/notifications                |        |
| Service    | SendGrid email, Twilio SMS        |        |
| Azure Func | sms-alerts                        |        |
| Infra      | SendGrid/Twilio env vars          |        |
| Tests      | Unit (mocked)                     |        |

### 10. Audit Trail

| Layer      | Expected                 | Status |
| ---------- | ------------------------ | ------ |
| UI         | Audit log viewer (admin) |        |
| API        | /api/audit               |        |
| Service    | Audit log service        |        |
| Azure Func | audit-log processor      |        |
| Storage    | Persistent audit storage |        |
| Tests      | Unit + E2E               |        |

### 11. Health & Monitoring

| Layer | Expected                            | Status |
| ----- | ----------------------------------- | ------ |
| UI    | Connection status banner            |        |
| API   | /api/health                         |        |
| Infra | Application Insights, Log Analytics |        |
| Infra | Metric alerts, budget alerts        |        |
| CI/CD | Health check after deploy           |        |

## Output Format

Write findings to `.claude/reports/vertical-features-report.md` with a filled-in matrix for each
feature showing COMPLETE / PARTIAL / MISSING at each layer, plus specific gaps and recommended actions.
