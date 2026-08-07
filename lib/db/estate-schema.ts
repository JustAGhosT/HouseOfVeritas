/**
 * Estate operational schema (PostgreSQL).
 *
 * Backs the entities in `lib/domain/estate-types` that previously lived in
 * Baserow. Kept separate from `lib/db/postgres.ts` — that file owns the
 * identity/audit/upload core, this one owns operational estate data — but it
 * follows the same conventions: idempotent `IF NOT EXISTS` DDL, snake_case
 * columns, `TIMESTAMPTZ` defaults, safe to run on every boot.
 *
 * Identity columns are integer so they satisfy `EntityId` (currently `number`)
 * without a domain change.
 */

import { isPostgresConfigured, withClient } from "@/lib/db/postgres"
import { logger } from "@/lib/logger"

const ESTATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS employees (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name TEXT NOT NULL,
    id_number TEXT,
    role TEXT NOT NULL,
    employment_start_date DATE,
    probation_status TEXT,
    contract_ref TEXT,
    leave_balance NUMERIC NOT NULL DEFAULT 0,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    photo TEXT,
    onboarding_status TEXT,
    buddy_id INTEGER,
    it_provisioned_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(LOWER(email));`,

  `CREATE TABLE IF NOT EXISTS assets (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset_id TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    purchase_date DATE,
    price NUMERIC,
    condition TEXT NOT NULL DEFAULT 'Unknown',
    location TEXT NOT NULL DEFAULT '',
    checked_out_by INTEGER,
    check_out_date TIMESTAMPTZ,
    photo TEXT,
    expected_return_date TIMESTAMPTZ,
    late_return_lockout_until TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
  CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);
  CREATE INDEX IF NOT EXISTS idx_assets_checked_out_by ON assets(checked_out_by);`,

  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to INTEGER,
    assigned_to_name TEXT,
    due_date DATE,
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Not Started',
    time_spent NUMERIC,
    completion_notes TEXT,
    related_asset INTEGER,
    project TEXT,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_date TIMESTAMPTZ,
    depends_on INTEGER[]
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_created_date ON tasks(created_date DESC);`,

  `CREATE TABLE IF NOT EXISTS time_clock_entries (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee INTEGER NOT NULL,
    employee_name TEXT,
    date DATE NOT NULL,
    -- "HH:MM" wall-clock strings, matching the existing domain contract for
    -- TimeClockEntry.clockIn/clockOut. Deliberately TEXT, not TIME/TIMESTAMPTZ:
    -- the app compares and displays these as plain strings.
    clock_in TEXT,
    clock_out TEXT,
    break_duration NUMERIC,
    total_hours NUMERIC,
    overtime_hours NUMERIC,
    approval_status TEXT NOT NULL DEFAULT 'Pending',
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_time_clock_employee ON time_clock_entries(employee);
  CREATE INDEX IF NOT EXISTS idx_time_clock_date ON time_clock_entries(date DESC);`,

  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    requester INTEGER NOT NULL,
    requester_name TEXT,
    type TEXT NOT NULL DEFAULT 'Request',
    category TEXT NOT NULL DEFAULT '',
    amount NUMERIC NOT NULL DEFAULT 0,
    vendor TEXT,
    date DATE NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'Pending',
    receipt TEXT,
    project TEXT,
    milestone TEXT,
    notes TEXT,
    approver INTEGER,
    approval_date TIMESTAMPTZ,
    secondary_approver INTEGER,
    secondary_approval_date TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_requester ON expenses(requester);
  CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(approval_status);`,

  `CREATE TABLE IF NOT EXISTS vehicle_logs (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    driver INTEGER NOT NULL,
    driver_name TEXT,
    vehicle INTEGER NOT NULL,
    vehicle_name TEXT,
    date_out TIMESTAMPTZ NOT NULL,
    date_in TIMESTAMPTZ,
    odometer_start NUMERIC NOT NULL DEFAULT 0,
    odometer_end NUMERIC,
    distance NUMERIC,
    fuel_added NUMERIC,
    fuel_cost NUMERIC,
    child_passenger BOOLEAN,
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_vehicle_logs_driver ON vehicle_logs(driver);`,

  `CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending',
    approver INTEGER,
    approved_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee);
  CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);`,

  `CREATE TABLE IF NOT EXISTS loans (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee INTEGER NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    purpose TEXT NOT NULL DEFAULT '',
    repayment_schedule TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    outstanding_balance NUMERIC NOT NULL DEFAULT 0,
    next_repayment_date DATE,
    approved_by INTEGER,
    approved_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_loans_employee ON loans(employee);
  CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);`,

  `CREATE TABLE IF NOT EXISTS petty_cash (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    requester INTEGER NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    purpose TEXT NOT NULL DEFAULT '',
    receipt TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    issued_by INTEGER,
    issued_at TIMESTAMPTZ,
    approved_by INTEGER,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_petty_cash_requester ON petty_cash(requester);
  CREATE INDEX IF NOT EXISTS idx_petty_cash_status ON petty_cash(status);`,

  `CREATE TABLE IF NOT EXISTS onboarding_checklists (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee INTEGER NOT NULL,
    items TEXT NOT NULL DEFAULT '',
    completed_at TIMESTAMPTZ,
    assigned_buddy INTEGER,
    status TEXT NOT NULL DEFAULT 'In Progress',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_onboarding_employee ON onboarding_checklists(employee);`,

  `CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category TEXT NOT NULL DEFAULT '',
    amount NUMERIC NOT NULL DEFAULT 0,
    period TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Draft',
    approved_by INTEGER,
    approved_at TIMESTAMPTZ,
    docuseal_ref TEXT,
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period);
  CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);`,

  `CREATE TABLE IF NOT EXISTS ppe_records (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asset INTEGER NOT NULL,
    issued_to INTEGER NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE,
    return_date DATE,
    status TEXT NOT NULL DEFAULT 'Issued',
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_ppe_issued_to ON ppe_records(issued_to);
  CREATE INDEX IF NOT EXISTS idx_ppe_status ON ppe_records(status);`,

  `CREATE TABLE IF NOT EXISTS policy_versions (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document INTEGER NOT NULL,
    version TEXT NOT NULL DEFAULT '',
    effective_date DATE NOT NULL,
    superseded_by INTEGER,
    status TEXT NOT NULL DEFAULT 'Current',
    docuseal_ref TEXT,
    notes TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS contractor_contracts (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    contractor TEXT NOT NULL DEFAULT '',
    project TEXT NOT NULL DEFAULT '',
    milestones TEXT NOT NULL DEFAULT '',
    amounts TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active',
    start_date DATE,
    end_date DATE,
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_contractor_contracts_status ON contractor_contracts(status);`,

  `CREATE TABLE IF NOT EXISTS insurance_claims (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incident INTEGER,
    asset INTEGER,
    description TEXT NOT NULL DEFAULT '',
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Draft',
    claim_id TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_insurance_claims_incident ON insurance_claims(incident);
  CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status);`,

  `CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type TEXT NOT NULL DEFAULT '',
    date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    location TEXT,
    reporter INTEGER,
    description TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'Low',
    status TEXT NOT NULL DEFAULT 'Open',
    related_asset INTEGER,
    related_employee INTEGER,
    related_incident_ids TEXT,
    victim_support_path BOOLEAN
  );
  CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(type);
  CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);`,

  `CREATE TABLE IF NOT EXISTS recurring_task_templates (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    description TEXT,
    assigned_to INTEGER,
    recurrence TEXT,
    is_recurring BOOLEAN NOT NULL DEFAULT true,
    priority TEXT,
    project TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_recurring_templates_active ON recurring_task_templates(is_recurring);`,

  `CREATE TABLE IF NOT EXISTS document_expiry (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    doc_name TEXT NOT NULL DEFAULT 'Untitled Document',
    type TEXT NOT NULL DEFAULT 'General',
    last_review DATE,
    next_review DATE,
    party_responsible INTEGER[],
    superseded_by INTEGER[],
    version_blocked BOOLEAN NOT NULL DEFAULT false,
    docuseal_ref TEXT,
    status TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_document_expiry_next_review ON document_expiry(next_review);`,
] as const

let schemaReady: Promise<void> | null = null

async function createEstateSchema(): Promise<void> {
  await withClient(async (client) => {
    for (const ddl of ESTATE_TABLES) {
      await client.query(ddl)
    }
  })
}

/**
 * Create the estate tables if absent. Idempotent and memoised per process, so
 * repository calls can await it cheaply without serialising on every query.
 *
 * No-ops when Postgres is unconfigured, matching `ensureSchema()` in
 * `lib/db/postgres.ts` — an unconfigured store yields empty reads, not a crash.
 */
export async function ensureEstateSchema(): Promise<void> {
  if (!isPostgresConfigured()) return

  schemaReady ??= createEstateSchema().catch((error: unknown) => {
    // Reset so a transient failure (e.g. database still booting) can be retried
    // on the next call rather than poisoning the process.
    schemaReady = null
    logger.error("Estate schema creation failed", {
      error: error instanceof Error ? error.message : "unknown",
    })
    throw error
  })

  return schemaReady
}

export function resetEstateSchemaForTests(): void {
  schemaReady = null
}
