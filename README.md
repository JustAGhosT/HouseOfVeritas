# House of Veritas -- Intelligent Physical Estate

House of Veritas is an intelligent physical-estate operating system governed by
AI and the first vertical product built on NexaMesh. It joins estate governance,
people, spaces, assets, vehicles, work, money, documents, incidents, and
accountable decisions in one human-controlled operating layer.

The current production system is the digital control-plane foundation. Trusted
sensor events, device twins, local edge agents, mesh transport, and automated
physical responses are roadmap capabilities and are not represented as live.

**App URL:** [nl-prod-hov-app.azurewebsites.net](https://nl-prod-hov-app.azurewebsites.net) | **Region:** South Africa North | **Status:** Canonical production live

HOV is now architecturally part of the NexaMesh product family, while its
current repository, runtime, shared data dependency, and
`hov.neuralliquid.ai` compatibility hostname remain unchanged pending a
separately reviewed migration. See
[ADR-014](docs/02-architecture/14-nexamesh-product-boundary-adr.md).

## Product boundary

- **HOV owns estate truth:** people, policy, assets, work, incidents, finance,
  documents, decisions, and retained domain evidence.
- **NexaMesh owns the physical-world substrate:** device identity, trusted
  observations, edge execution, mesh transport, device health, and provenance
  primitives.
- **AI providers remain contracted dependencies:** reasoning and analysis do
  not receive implicit ownership of estate records.

---

## Features

- **Multi-persona Dashboards** -- Role-based access for Owner, Workshop, Garden, and Household
- **Document Management** -- Digital signing via DocuSeal with full audit trails
- **Asset and Inventory** -- CRUD, photo gallery, barcode scanning, condition tracking
- **Task and Time Tracking** -- Assignment, clock in/out, overtime calculation (BCEA)
- **Expense Management** -- Submit, approve, receipt capture, OCR import
- **Marketplace** -- Multi-platform listing with AI-generated descriptions
- **OCR Scanner** -- Invoice and receipt processing via Azure Document Intelligence
- **Compliance** -- POPIA, BCEA, ECT Act compliant with full audit logging
- **Physical-estate foundation** -- Assets, locations, incidents, maintenance,
  vehicles, and operational workflows ready for future authenticated NexaMesh
  observations

---

## Tech Stack

| Category  | Technology                                        |
| --------- | ------------------------------------------------- |
| Framework | Next.js 16 (App Router)                           |
| Language  | TypeScript 5                                      |
| Styling   | Tailwind CSS 4 + Shadcn/UI                        |
| Backend   | Next.js API routes; DocuSeal and Baserow optional |
| Database  | Empty/local mode by default; PostgreSQL optional  |
| Storage   | Azure Blob Storage (LRS baseline)                 |
| OCR       | Azure Document Intelligence optional              |
| IaC       | Terraform 1.5+                                    |
| CI/CD     | GitHub Actions                                    |
| Cloud     | Azure (South Africa North)                        |

---

## Quick Start

### Local Development

```bash
yarn install
yarn dev
```

See [Local Development Guide](docs/03-deployment/02-local-development.md) for Docker-based setup with DocuSeal, Baserow, and PostgreSQL. For workflow env vars (e.g. `USE_INNGEST_APPROVALS`), see [Workflow env](docs/04-configuration/06-workflow-env.md).

### Azure Deployment

Production currently uses the low-cost canonical baseline: App Service,
Storage, Key Vault, and VNet. Optional services such as Baserow, DocuSeal,
PostgreSQL, Cosmos DB, Functions, Document Intelligence, monitoring, and
Application Gateway are disabled until explicitly justified.

```powershell
cd terraform\environments\production
terraform init -backend-config="backend.hcl"
terraform plan -var-file="terraform.tfvars" -out=tfplan
terraform apply tfplan
```

See [Canonical Azure Production Profile](docs/03-deployment/07-canonical-azure-naming-migration.md)
and [Deployment Guide](docs/03-deployment/01-deployment-guide.md) for complete instructions.

---

## Project Structure

```
HouseOfVeritas/
├── app/                           Next.js application (pages, API routes)
├── components/                    React components (UI, scanners, layouts)
├── lib/                           Utilities, services, hooks
├── config/                        Docker, Nginx, scripts, Azure Functions
├── terraform/                     Infrastructure as Code
│   ├── environments/production/   Production config
│   └── modules/                   Reusable modules (8 modules)
├── .github/workflows/             CI/CD pipelines
├── .env.local                     Local secrets (gitignored)
└── docs/                          Documentation
    ├── 01-product/                Platform spec, functional design, PRD
    ├── 02-architecture/           Technical design, naming, infrastructure
    ├── 03-deployment/             Deploy guide, local dev, CI/CD
    ├── 04-configuration/          DocuSeal, Baserow, Functions, templates
    └── 05-project/                Backlog, roadmap, changelog, contributing
```

---

## Documentation

| Section                                 | Contents                                                        |
| --------------------------------------- | --------------------------------------------------------------- |
| [Product](docs/01-product/)             | Platform specification, functional design, product requirements |
| [Architecture](docs/02-architecture/)   | Technical design, naming convention, infrastructure map         |
| [Deployment](docs/03-deployment/)       | Azure deployment, local development, CI/CD workflows            |
| [Configuration](docs/04-configuration/) | DocuSeal, Baserow, Azure Functions, document templates          |
| [Project](docs/05-project/)             | Backlog, roadmap, test report, changelog, contributing          |

Full index: [docs/README.md](docs/README.md)

---

## License

Proprietary -- House of Veritas (c) 2026
