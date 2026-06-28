# n8n Business Rules Setup

n8n provides visual workflow automation for business-user-defined rules. Deploy via Docker Compose (see `config/docker-compose.yml`).

## Deployment

```bash
cd config
docker compose up -d n8n
```

Access n8n at http://localhost:5678. Create an owner account on first use or configure secure authentication before production. **MUST change before production** — never use default or guessable credentials. The env vars `N8N_BASIC_AUTH_USER` and `N8N_BASIC_AUTH_PASSWORD` are deprecated/legacy in n8n v1; use n8n's built-in user management instead.

## Connectors

1. **Baserow** — Add Baserow credential with `BASEROW_API_TOKEN` and `BASEROW_URL`
2. **SendGrid** — For email notifications
3. **Twilio** — For SMS (incident escalation)
4. **WhatsApp** — For staff notifications (optional)
   Verify each finding against the current code and only fix it if needed.

In @docs/02-architecture/n8n-business-rules.md around lines 92 - 101, The example POST to n8n via the fetch call is unsafe: add an explicit environment guard for process.env.N8N_WEBHOOK_URL (throw or return early if missing), include an Authorization header or webhook secret when calling `${process.env.N8N_WEBHOOK_URL}/webhook/expense-created`, and wrap the fetch in try/catch plus check response.ok (and log or throw on non-2xx) so failures aren’t silently ignored; update the example around the fetch invocation, the N8N_WEBHOOK_URL usage, and headers to implement these checks and error handling.Verify each finding against the current code and only fix it if needed.

In @docs/02-architecture/n8n-business-rules.md around lines 92 - 101, The webhook POST example lacks authentication, an env-var guard, and error handling; update the code around the fetch call that builds the URL using process.env.N8N_WEBHOOK_URL to first validate the env var and throw a clear config error if missing, add an Authorization header (or configurable WEBHOOK_SECRET) to the headers passed to fetch, and handle the fetch response by checking response.ok and throwing/logging a descriptive error (including response.status/text) or retrying as appropriate so non-2xx responses are not silently ignored.

## Business Rules to Implement

### Core Rules (Priority)

| Rule                   | Trigger                     | Condition                                        | Action                          |
| ---------------------- | --------------------------- | ------------------------------------------------ | ------------------------------- |
| Expense > R5k          | Webhook on expense created  | `amount > 5000`                                  | Notify Hans; secondary approval |
| Incident High/Critical | Webhook on incident created | `severity` in [High, Critical]                   | SMS Hans via Twilio             |
| Task Overdue > 3 days  | Daily or Baserow webhook    | `status !== Completed` AND `dueDate` < today - 3 | Notify Hans; escalate           |
| Mileage > 100k         | Vehicle log webhook         | `odometerEnd` or `odometerStart` > 100k          | Create task; notify Charl       |

### Employee & Onboarding (n8n)

- **New hire onboarding:** DocuSeal contract signed → create employee record, assign checklist, welcome email, ID doc upload task
- **Exit workflow:** Termination logged → asset return checklist, deactivate access, exit interview, payroll trigger

### Asset Management (n8n)

- **Asset check-in/out:** On allocation → log in Baserow, send return reminder by due date
- **Maintenance due:** Asset due for service → create task, notify assignee, escalate to Hans after 48h
- **Damaged/missing:** Incident with asset reference → assign to maintenance, log cost, update insurance

### Incident & Safety (n8n)

- **Investigation workflow:** New incident → assign to Hans, set deadline, auto-remind if overdue
- **Repeat incident:** Same type within period → escalate (review meeting, policy change)
- **Safety equipment checks:** Rotate responsibility, log result in Baserow
- **Emergency plan review:** Annual → DocuSeal "review and sign"

### Payroll & Leave (n8n)

- **Leave request:** Employee submits → notify Hans; 48h escalation; approved → update calendar/rota
- **Budget variance:** Weekly aggregate actuals vs budget → alert if 90% with projected overrun

### Policy & Feedback (n8n)

- **Policy change:** Amend House Rules → notify signatories, lock old version, require new DocuSeal e-sign
- **Feedback loop:** After incident closed, contractor job → survey via WhatsApp/email
- **Contractor performance:** After job → review/rating request; log negative events
- **Micro-incident trend:** Weekly tally minor issues → if pattern, create action for Hans
- **Celebration:** Milestone (12 months no incident) → congrats message, badge
- **Rota autopilot:** Leave/illness → auto-adjust rota, ping next in chain
- **Emergency protocol live test:** Twice yearly → mock SMS, capture responses, report gaps
- **Cross-function coordination:** Blocked workflow → coordinated reminders to all involved

## Inngest vs n8n

- **Inngest:** Cron-based, durable, event-driven (e.g. document expiry, probation reminder, payroll summary, task overdue)
- **n8n:** Assignment logic, notifications, multi-service orchestration, business-user rules

See [10-workflow-specifications.md](10-workflow-specifications.md) for full workflow catalog.

## New Webhooks (Swimlane Implementation)

Events emitted by Inngest/Next.js that n8n can consume:

| Event                                              | Payload                                                     | Use Case                                |
| -------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| `house-of-veritas/leave.request.submitted`         | id, employeeId, startDate, endDate, type, days              | Leave 48h escalation                    |
| `house-of-veritas/loan.request.submitted`          | id, employeeId, amount, purpose                             | Loan approval flow                      |
| `house-of-veritas/petty.cash.request.submitted`    | id, requesterId, amount, purpose                            | Petty cash approval                     |
| `house-of-veritas/petty.cash.policy.violation`     | requesterId, amount, reason                                 | Policy violation alert                  |
| `house-of-veritas/kitchen.cross.contamination`     | taskId, description, location                               | Cross-contamination escalation          |
| `house-of-veritas/kitchen.meal.feedback`           | taskId, description, mealName, servedBy, location, severity | Meal quality review escalation          |
| `house-of-veritas/employee.created`                | employeeId, name, email                                     | Welcome email, checklist, ID doc upload |
| `house-of-veritas/onboarding.checklist.progressed` | checklistId, employeeId                                     | IT provisioning trigger                 |
| `house-of-veritas/succession.live.test`            | successorId, duration                                       | Live succession test                    |

## Webhook Integration

Next.js can send events to n8n via HTTP:

```typescript
// Example: POST to n8n webhook when expense created
await fetch(`${process.env.N8N_WEBHOOK_URL}/webhook/expense-created`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ amount, category, id }),
})
```

Configure `N8N_WEBHOOK_URL` in environment (e.g. http://localhost:5678 for local dev).
