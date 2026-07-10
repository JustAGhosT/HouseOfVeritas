# House of Veritas -- Digital Governance Platform

A comprehensive estate and asset management platform for private households and small estates, featuring secure document signing, operational tracking, inventory management, and AI-powered automation.

**App URL:** [nl-prod-hov-app.azurewebsites.net](https://nl-prod-hov-app.azurewebsites.net) | **Region:** South Africa North | **Status:** Canonical production live

`nexamesh.ai` currently serves the shared Neualliquid/Nexamesh portfolio surface
for House of Veritas, Cog-Mesh, Omnipost, and Convolens. It is not bound
directly to the House of Veritas App Service unless a custom-domain cutover is
performed.

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

---

## Tech Stack

| Category  | Technology                         |
| --------- | ---------------------------------- |
| Framework | Next.js 16 (App Router)            |
| Language  | TypeScript 5                       |
| Styling   | Tailwind CSS 4 + Shadcn/UI         |
| Backend   | Next.js API routes; DocuSeal and Baserow optional |
| Database  | Empty/local mode by default; PostgreSQL optional |
| Storage   | Azure Blob Storage (LRS baseline)  |
| OCR       | Azure Document Intelligence optional |
| IaC       | Terraform 1.5+                     |
| CI/CD     | GitHub Actions                     |
| Cloud     | Azure (South Africa North)         |

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
