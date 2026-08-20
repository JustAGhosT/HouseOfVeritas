# House of Veritas - Product Requirements Document

## Overview

House of Veritas is a comprehensive digital governance platform for estate management, combining
legally enforceable e-signatures, operational tracking, and compliance automation.

## Original Problem Statement

Transform an existing work management platform codebase into a professional, dashboard-centric
governance and estate management platform for an entity called "House of Veritas".

## Core Requirements

### Aesthetic & Design

- Professional, trustworthy, dark theme with clean typography
- Primary blue (#1E40AF) for trust, secondary green (#059669) for operations
- Accent orange for alerts, dark charcoal background with subtle grid pattern
- **Persona-specific visual themes:**
  - Hans (Blue): Tech/circuit patterns, network nodes, CPU/monitor vectors
  - Charl (Amber/Orange): Workshop/tools patterns, gears, wrenches, mechanical vectors
  - Lucky (Green): Garden/nature patterns, leaves, flowers, trees, grass vectors
  - Irma (Purple/Pink): Home/domestic patterns, hearts, houses, sparkles vectors

### User Personas (4 Users)

1. **Hans** - Owner/Administrator - Tech Lead, Electronics, Leadership
   - Email: <hans@houseofv.com> | Phone: +27692381255
   - Full platform access, approvals, oversight, can view all dashboards

2. **Charl** - Workshop Operator - Electrician, Plumber, Tinkerer, Magicman
   - Email: <charl@houseofv.com> | Phone: +27711488390
   - Tasks, assets, time tracking, vehicle logs

3. **Lucky** - Gardener & Handyman - Gardening, Painting, Manual Labour
   - Email: <lucky@houseofv.com> | Phone: +27794142410
   - Tasks, expenses, vehicle logs, time tracking

4. **Irma** - Resident - Babysitting, Cleaning, Food/Cooking
   - Email: <irma@houseofv.com> | Phone: +27711488390
   - Household tasks, documents, meal planning

### Technology Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, Recharts
- **Backend:** Next.js API Routes with integration services
- **External Services:** DocuSeal (e-signatures), Baserow (operational DB)
- **Database:** PostgreSQL 14 (via Baserow)
- **Infrastructure:** Azure (Terraform-managed)

---

## Implementation Status

### ✅ Phase 1: MVP Landing Page (COMPLETE)

- Landing page with HV branding
- 8 feature module showcases
- Stats section with live data from APIs
- Role-based dashboard previews

### ✅ Phase 2: Infrastructure (COMPLETE)

- Terraform IaC for Azure
- CI/CD GitHub Actions workflows
- Supervisor management for Next.js

### ✅ Phase 3: Core Platform Setup (COMPLETE)

- DocuSeal/Baserow configuration files
- Docker Compose templates
- Environment variable templates

### ✅ Phase 4: Integration & Automation (COMPLETE)

- Azure Functions placeholders
- Webhook handlers
- Document expiry alerts

### ✅ Phase 5: User Experience & Polish (COMPLETE - Feb 20, 2026)

- **Authentication System:**
  - Single login form (email/password)
  - Route protection - authenticated users only
  - Permission-based access (Hans can view all dashboards)
  - Logout functionality with session clearing
  - Password reset via SMS (Twilio ready, **SIMULATED** in dev)

- **Notification System:**
  - Real-time notifications per user
  - Notification bell with unread count
  - Mark as read / Mark all as read
  - Clear notifications
  - Demo notifications seeded

- **Persona-Specific Dashboards:**
  - Unique visual themes with SVG background patterns
  - Interactive charts (Recharts)
  - Role-specific widgets and data

### ✅ Phase 6: Frontend Integration (COMPLETE - Feb 20, 2026)

- **Integration Services Created:**
  - `/app/lib/services/docuseal.ts` - DocuSeal API integration
  - `/app/lib/services/baserow.ts` - Baserow API integration
- **API Endpoints Updated:**
  - `GET /api/integration/status` - Check all service connections
  - `GET/POST /api/documents/templates` - Document templates
  - `GET/POST /api/documents/sign` - Signature submissions
  - `GET/POST/PATCH /api/tasks` - Task management with Baserow
  - `GET/POST/PATCH /api/expenses` - Expense tracking
  - `GET /api/assets` - Asset registry
  - `GET/POST /api/time` - Time clock (clock in/out)
  - `GET /api/vehicles` - Vehicle logs
  - `GET /api/employees` - Employee data

- **Features:**
  - Graceful fallback to mock data when services not configured
  - Ready for production deployment with environment variables
  - All APIs return `configured` flag to indicate data source

---

## API Endpoints

### Authentication

- `POST /api/auth/login` - User authentication
- `POST /api/auth/reset-password` - Password reset (SMS/Email)
- `GET /api/auth/users` - Get all users

### Integration

- `GET /api/integration/status` - Service connection status

### Documents (DocuSeal)

- `GET /api/documents/templates` - List document templates
- `GET /api/documents/sign?id=` - Get signature status
- `POST /api/documents/sign` - Create signature request

### Operations (Baserow)

- `GET/POST/PATCH /api/tasks` - Task management
- `GET/POST/PATCH /api/expenses` - Expense tracking
- `GET /api/assets` - Asset registry
- `GET/POST /api/time` - Time clock
- `GET /api/vehicles` - Vehicle logs
- `GET /api/employees` - Employee data

---

## Environment Variables (for Production)

```env
# DocuSeal
DOCUSEAL_API_URL=https://sign.nexamesh.ai/api
DOCUSEAL_API_KEY=your_api_key

# Baserow
BASEROW_API_URL=https://ops.nexamesh.ai/api
BASEROW_API_TOKEN=your_token
BASEROW_DATABASE_ID=your_db_id
BASEROW_TABLE_EMPLOYEES=table_id
BASEROW_TABLE_ASSETS=table_id
BASEROW_TABLE_TASKS=table_id
BASEROW_TABLE_TIME_CLOCK=table_id
BASEROW_TABLE_EXPENSES=table_id
BASEROW_TABLE_VEHICLE_LOGS=table_id

# Twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

### ✅ Phase 7: Testing & UAT (COMPLETE - Feb 20, 2026)

- **Automated Tests:** 24/24 passed (100% success rate)
- **E2E Testing:** All user flows verified
- **Security Audit:** Passed all checks
  - No password exposure in API responses
  - Input validation working
  - XSS prevention (React escaping)
  - Generic error messages (no info leakage)
- **Performance:** All APIs under 15ms response time
- **Test Report:** `/app/docs/05-project/03-test-report.md`

### ✅ Phase 7.5: Real-Time Updates (COMPLETE - Feb 20, 2026)

- **Server-Sent Events (SSE) Implementation:**
  - `/app/app/api/realtime/events/route.ts` - SSE connection endpoint
  - `/app/app/api/realtime/emit/route.ts` - Event broadcast endpoint
  - `/app/lib/realtime/event-store.ts` - In-memory event store
  - `/app/lib/hooks/use-realtime.ts` - React hook for SSE
  - `/app/components/realtime-indicator.tsx` - Connection status + toast notifications
- **Features:**
  - Real-time connection indicator (Live/Offline status)
  - Automatic reconnection on disconnect
  - Event history on connect
  - Toast notifications for important events
  - Activity feed component for dashboards
  - Heartbeat to keep connections alive

- **Event Types Supported:**
  - `task_created`, `task_updated`, `task_completed`
  - `expense_created`, `expense_approved`, `expense_rejected`
  - `clock_in`, `clock_out`
  - `notification`, `approval_required`, `system_alert`

- **Supervisor Cleanup:**
  - Removed legacy `backend` and `frontend` service definitions
  - Only `mongodb`, `nextjs`, and `nginx-code-proxy` now active

### ✅ Phase 8: Enhanced Features (COMPLETE - Feb 20, 2026)

#### PWA + Mobile Optimization

- `/app/public/manifest.json` - PWA manifest with app metadata
- `/app/public/sw.js` - Service worker for offline support
- `/app/lib/hooks/use-pwa.tsx` - PWA installation and offline detection hooks
- `/app/app/offline/page.tsx` - Offline fallback page
- Install banner for adding app to home screen
- Offline status indicator in header

#### Multi-Language Support (i18n)

- `/app/lib/i18n/translations.ts` - Translation keys for EN, Afrikaans, Zulu
- `/app/lib/i18n/context.tsx` - i18n React context and hooks
- Language selector component in settings
- Full translations for common UI elements

#### Notification Service

- `/app/lib/services/notification-service.ts` - SMS (Twilio), Email, Push support
- `/app/app/api/notifications/route.ts` - Notification API endpoint
- Templated notifications for approvals, expiry alerts, etc.
- **Note:** SMS/Email currently SIMULATED - configure Twilio for production

#### Advanced Reporting

- `/app/components/reports-panel.tsx` - Interactive report generation
- `/app/app/api/reports/route.ts` - Reports API (expenses, tasks, time)
- CSV export functionality
- **PDF export** with professional formatting (jsPDF)
- Summary cards with statistics
- Date range filtering

#### Activity Timeline & Audit Log

- `/app/lib/audit-log.ts` - Audit logging system
- `/app/app/api/audit/route.ts` - Audit log API with CSV export
- `/app/components/activity-timeline.tsx` - Visual activity timeline
- Tracks logins, task changes, expenses, documents, etc.

#### File Upload System

- `/app/app/api/uploads/route.ts` - File upload API
- Support for images, documents, receipts
- File type validation and size limits
- Metadata storage for file tracking

### ✅ Phase 9: Advanced Features (COMPLETE - Feb 20, 2026)

#### Google Calendar Integration

- `/app/app/api/calendar/route.ts` - Calendar API with CRUD operations
- `/app/components/calendar-panel.tsx` - Interactive calendar UI
- Event creation, viewing, deletion
- Monthly calendar view with event indicators
- **Mode:** MOCK (configure GOOGLE_CLIENT_ID/SECRET for live sync)

#### Predictive Maintenance AI

- `/app/app/api/ai/maintenance/route.ts` - AI-powered predictions
- `/app/components/predictive-maintenance.tsx` - Maintenance dashboard
- Asset health analysis and predictions
- 6-month cost forecasting
- Urgent maintenance alerts
- **Powered by:** Emergent LLM Key + GPT-5.2

#### PDF Report Generation

- `/app/lib/utils/pdf-generator.ts` - Professional PDF reports
- Branded headers with HV logo
- Expense, task, time, and audit reports
- Summary tables and statistics
- Page numbers and footers

### ✅ Phase 10: Payroll & Biometric (COMPLETE - Feb 20, 2026)

#### Payroll Integration (QuickBooks-Ready)

- `/app/app/api/payroll/route.ts` - Payroll API with mock data
- `/app/components/payroll-panel.tsx` - Payroll management UI
- Employee payroll calculations (gross, deductions, net)
- Tax, UIF, pension deduction breakdown
- CSV export functionality
- **Mode:** MOCK (configure QUICKBOOKS_CLIENT_ID/SECRET for live sync)

#### Biometric Time Clock

- `/app/app/api/biometric/route.ts` - Biometric attendance API
- `/app/components/biometric-time-clock.tsx` - Time clock UI
- Fingerprint and face recognition support
- Real-time employee status (working/completed/not clocked)
- Clock in/out with location tracking
- Device status monitoring
- **Mode:** MOCK (configure BIOMETRIC_API_KEY for hardware integration)

#### Automated Maintenance Scheduling

- `/app/app/api/maintenance/schedule/route.ts` - Maintenance scheduling API
- Auto-schedule from AI predictions to calendar
- Creates calendar events for upcoming maintenance
- Tracks scheduled, in-progress, and completed maintenance
- Cost estimation and urgent item alerts

#### New Pages

- `/app/app/dashboard/hans/settings/page.tsx` - Language, notifications, PWA
- `/app/app/dashboard/hans/reports/page.tsx` - Reports & activity logs
- `/app/app/dashboard/hans/calendar/page.tsx` - Calendar view
- `/app/app/dashboard/hans/maintenance/page.tsx` - Predictive maintenance
- `/app/app/dashboard/hans/payroll/page.tsx` - Payroll & biometric time clock

### ✅ Phase 11: Asset Management, OCR & Marketplace (COMPLETE - Feb 20, 2026)

#### Asset Management System

- `/app/app/api/assets/enhanced/route.ts` - Enhanced asset CRUD API
- `/app/app/dashboard/hans/assets/page.tsx` - Asset management UI
- Full CRUD operations with photos, conditions, sale status
- Asset categories: vehicles, garden equipment, workshop tools, electronics, etc.
- Condition tracking: excellent, good, fair, poor, needs repair
- Sale status: not for sale, for sale, pending sale, sold
- Brand, model, serial number tracking
- Purchase price and current value tracking
- Maintenance history logging
- Location and responsibility assignment
- Tag-based organization

#### Inventory Tracking System

- `/app/app/api/inventory/route.ts` - Inventory management API
- `/app/app/dashboard/hans/inventory/page.tsx` - Inventory UI for Hans
- `/app/app/dashboard/lucky/inventory/page.tsx` - Garden inventory for Lucky
- Stock level tracking with min/max/reorder points
- Low stock and critical alerts
- Consumption logging with purpose tracking
- Restock functionality with cost updates
- Shopping list generation with store links
- Import from OCR feature
- **Barcode/QR code scanning** for quick item lookup

#### Barcode Scanner

- `/app/components/barcode-scanner.tsx` - Barcode/QR scanner component
- Support for: QR Code, EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39
- Camera-based scanning with torch support
- Scan modes: Lookup, Consume, Restock
- Real-time item lookup by barcode
- Haptic feedback on successful scan
- Barcode displayed in inventory table rows
- Uses `html5-qrcode` library

#### Barcode Label Printing

- `/app/components/barcode-label-generator.tsx` - Label generation component
- Configurable label sizes: Small (180×80), Medium (240×100), Large (300×150)
- Code types: Code 128, QR Code
- Toggle options: Show Name, Barcode, Location, Category
- Select/deselect items for printing
- Live preview of labels
- Print to any connected printer
- Download as SVG files
- Generates proper Code 128 barcodes with checksums

#### Batch Scanning Operations

- `/app/components/batch-scanner.tsx` - Batch scanning component
- **Stock Count Mode** - Scan multiple items for inventory verification
- **Batch Consume Mode** - Record consumption for multiple items at once
- **Batch Restock Mode** - Add stock to multiple items simultaneously
- Default quantity and purpose settings
- Real-time item lookup and validation
- Found/Not Found status indicators
- Editable quantities per item
- Bulk submit to inventory API

#### OCR Document Scanner

- `/app/app/api/ocr/route.ts` - OCR processing API
- `/app/app/dashboard/hans/ocr/page.tsx` - OCR Scanner UI
- Document type selection: invoices, receipts, handwritten requests
- Drag-and-drop file upload
- Extracted text with structured data
- Line item detection with quantities and prices
- Vendor information extraction
- **Import to Inventory** - Auto-create inventory items from scanned invoices
- **Mode:** MOCK (configure AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT for live OCR)

#### Marketplace Integration

- `/app/app/api/marketplace/route.ts` - Marketplace management API
- `/app/app/dashboard/hans/marketplace/page.tsx` - Marketplace UI
- Platform support: Gumtree, Facebook Marketplace, OLX, BidOrBuy, AutoTrader
- AI-powered listing generation
- Auto-publish to multiple platforms (drafts)
- Listing tracking with views and inquiries
- Potential revenue calculation
- **Mode:** MOCK (creates draft listings, doesn't post to external platforms)

#### File Upload Implementation

- `/app/app/api/files/route.ts` - File upload API with Azure Blob support
- `/app/components/image-upload.tsx` - Image upload component
- Support for images and PDFs (10MB max)
- Azure Blob Storage ready (fallback to local storage)
- Chunked uploads for large files
- **Mode:** MOCK (uses local /tmp/uploads when Azure not configured)

#### Visual Enhancements

- `/app/app/globals.css` - Grid/3D room background CSS
- `/app/components/grid-room-background.tsx` - Grid background component
- Subtle perspective grid effect on dashboard pages
- Dark theme with grid floor effect

#### Updated Navigation

- Assets, Inventory, OCR Scanner, Marketplace added to Hans navigation
- Inventory added to Lucky navigation (garden supplies only)

#### Documentation Updates (Feb 21, 2026)

- `/app/docs/03-deployment/01-deployment-guide.md` - Complete deployment guide with:
  - PowerShell commands for Windows users
  - Bash commands for Linux/macOS users
  - Service Principal creation steps
  - GitHub secrets configuration
  - Terraform backend setup (Azure Blob Storage)
  - SSL certificate generation (Let's Encrypt)
  - Application setup and go-live checklist
  - Troubleshooting guide
- `/app/README.md` - Updated with current app features, API reference, project structure

### ✅ Phase 12: Employee Kiosk Mode (COMPLETE - Feb 21, 2026)

#### Mobile Kiosk Interface

- `/app/app/kiosk/page.tsx` - Complete kiosk UI with PIN-based authentication
- Mobile-first responsive design (optimized for tablets/phones)
- Real-time clock display with date

#### Kiosk Features

- **PIN-Based Login** - Simple 4-digit PIN entry with number pad
  - Charl (1234), Lucky (5678), Irma (9012), Hans (0000)
- **Clock In/Out** - Time tracking with status badge
- **Scan Item** - Barcode scanning for inventory lookup
- **Use Stock** - Quick consumption recording
- **My Tasks** - View and complete assigned tasks
- **Order Stock** - Submit stock order requests
  - Item name, quantity, urgency level, notes
- **Ask Advance** - Request salary advance
  - Amount, reason, repayment plan selection
  - Warning about management approval requirement
- **Report Issue** - Report maintenance/broken items
  - Asset name, issue type (broken/maintenance/safety/other)
  - Location, detailed description
  - Safety hazard priority flagging

#### Kiosk API

- `/app/app/api/kiosk/requests/route.ts` - Request management API
- **GET** - List requests with filters (employeeId, type, status)
- **POST** - Create new requests (stock_order, salary_advance, issue_report)
- **PATCH** - Update request status (approve/reject)
- Summary counts by type and status
- **Mode:** MOCK (in-memory storage)

### ✅ Phase 13: Manager Approval Workflow (COMPLETE - Feb 21, 2026)

#### Approval Center Dashboard

- `/app/app/dashboard/hans/approvals/page.tsx` - Manager approvals UI
- Summary cards: Pending count, Stock Orders, Advances, Issues
- Real-time "X pending" badge in header

#### Approval Features

- **Request List** - All pending requests with employee info, timestamps
- **Filters** - By type (stock/advance/issue) and status (pending/approved/rejected)
- **Search** - By employee name, item, or description
- **View Details** - Full request information dialog
- **Approve Workflow** - Confirmation dialog with optional notes
- **Reject Workflow** - Confirmation dialog with required reason
- **Visual Indicators**
  - Yellow left border for pending requests
  - Red "Safety" badge for safety hazards
  - Red "Urgent" badge for urgent stock orders
- **Auto-update** - List refreshes after approve/reject

#### Navigation Update

- Added "Approvals" to Hans's dashboard navigation (priority placement)
- CheckSquare icon for approval center

### ✅ Phase 14: MongoDB Persistence & Notifications (COMPLETE - Feb 21, 2026)

#### MongoDB Integration

- `/app/lib/db/mongodb.ts` - MongoDB connection utility
- Database: `house_of_veritas`
- Collection: `kiosk_requests`
- Auto-seeds 7 initial requests on first load
- ObjectId-based document IDs
- Full CRUD operations with persistent storage

#### Employee Request History

- **My Requests Button** - Added to kiosk main menu (indigo color)
- **Request History Dialog** - Shows employee's submitted requests
- **Status Badges** - Pending (yellow), Approved (green), Rejected (red)
- **Feedback Display** - Approved/rejected notes shown inline
- **Filter by Employee** - API supports `?employeeId=X` parameter

#### Notification System Integration

- **Approval Notifications** - SMS/WhatsApp/Email sent when request approved
- **Rejection Notifications** - SMS/WhatsApp/Email sent when request rejected
- **Manager Alerts** - In-app notification for new requests
- **Priority Escalation** - SMS added for urgent/safety items

### ✅ Phase 15: Notification Preferences System (COMPLETE - Feb 21, 2026)

#### User Preference Selection

- `/app/app/api/notifications/preferences/route.ts` - Preferences API
- MongoDB collection: `notification_preferences`
- Three channel options: SMS, WhatsApp, Email
- Persistent preference storage per user

#### Kiosk Notification Settings

- **Bell Icon** - Added to kiosk header for quick access
- **Preference Dialog** - Visual selection of preferred channel
- **Fallback Order Display** - Shows automatic fallback sequence
- **Auto-Fallback** - If primary fails, tries next option automatically

#### Twilio Integration

- Twilio SDK installed and configured
- SMS sending via `twilio.messages.create()`
- WhatsApp support via `whatsapp:` prefix
- Graceful fallback when delivery fails
- **Status:** Configured (awaiting production phone number)

---

## Upcoming Tasks

### P1: Real Marketplace API Integrations

- **Gumtree API** - Requires API credentials from user
- **eBay API** - Requires developer account setup
- **Facebook Marketplace** - Requires Facebook App credentials
- Service layer ready at `/app/lib/services/marketplace-service.ts`

### P2: Configure External Services

- **Azure Document Intelligence** - Provide AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and KEY for live OCR
- **Azure Blob Storage** - Provide connection string for image uploads

### P3: Production Deployment

- Deploy to Azure (requires Azure credentials)
- Configure production environment
- Set up Twilio for real SMS notifications
- Configure Google Calendar OAuth credentials
- Configure QuickBooks OAuth for live payroll
- Connect biometric hardware devices

---

## Future Enhancements (Backlog)

- Native Mobile Apps (React Native/Flutter)
- Vehicle GPS Tracking
- Advanced AI Analytics (trend analysis, anomaly detection)
- Online Store Integration (Cashbuild, Builders) for order lists
- Asset photo gallery with Azure Blob Storage
- Configure Twilio for real SMS notification delivery
- MongoDB Atlas for production deployment

---

## Files Reference

### Core Application

- `/app/lib/auth-context.tsx` - Auth provider with route protection
- `/app/lib/notification-context.tsx` - Notification system
- `/app/lib/services/docuseal.ts` - DocuSeal API integration
- `/app/lib/services/baserow.ts` - Baserow API integration
- `/app/lib/services/notification-service.ts` - SMS/Email/Push service
- `/app/lib/realtime/event-store.ts` - SSE event store
- `/app/lib/hooks/use-realtime.ts` - Real-time hook
- `/app/lib/hooks/use-pwa.tsx` - PWA hooks
- `/app/lib/i18n/translations.ts` - Multi-language translations
- `/app/lib/i18n/context.tsx` - i18n context
- `/app/lib/audit-log.ts` - Audit logging
- `/app/lib/db/mongodb.ts` - MongoDB connection utility
- `/app/components/notification-panel.tsx` - Notification UI
- `/app/components/realtime-indicator.tsx` - Real-time status indicator
- `/app/components/reports-panel.tsx` - Reports UI
- `/app/components/activity-timeline.tsx` - Activity timeline
- `/app/components/dashboard-layout.tsx` - Dashboard layout with grid background
- `/app/components/grid-room-background.tsx` - Grid/3D background component
- `/app/components/image-upload.tsx` - Image upload component
- `/app/app/login/page.tsx` - Login page
- `/app/app/offline/page.tsx` - Offline fallback
- `/app/app/kiosk/page.tsx` - Employee kiosk interface
- `/app/app/dashboard/*/page.tsx` - Persona dashboards
- `/app/app/dashboard/hans/approvals/page.tsx` - Manager approval center
- `/app/app/dashboard/hans/assets/page.tsx` - Asset management
- `/app/app/dashboard/hans/inventory/page.tsx` - Inventory management
- `/app/app/dashboard/hans/ocr/page.tsx` - OCR Scanner
- `/app/app/dashboard/hans/marketplace/page.tsx` - Marketplace
- `/app/app/dashboard/hans/settings/page.tsx` - Settings page
- `/app/app/dashboard/hans/reports/page.tsx` - Reports page
- `/app/app/dashboard/lucky/inventory/page.tsx` - Lucky's garden inventory

### Implementation API Endpoints

- `/app/app/api/kiosk/requests/route.ts` - Kiosk request API (MongoDB)
- `/app/app/api/realtime/events/route.ts` - SSE endpoint
- `/app/app/api/realtime/emit/route.ts` - Event emit API
- `/app/app/api/audit/route.ts` - Audit log API
- `/app/app/api/assets/enhanced/route.ts` - Asset management API
- `/app/app/api/inventory/route.ts` - Inventory API with OCR import
- `/app/app/api/ocr/route.ts` - OCR processing API
- `/app/app/api/marketplace/route.ts` - Marketplace management API
- `/app/app/api/files/route.ts` - File upload API
- `/app/app/api/reports/route.ts` - Reports API
- `/app/app/api/notifications/route.ts` - Notifications API
- `/app/app/api/uploads/route.ts` - File uploads API

### PWA Assets

- `/app/public/manifest.json` - PWA manifest
- `/app/public/sw.js` - Service worker
- `/app/public/icons/` - App icons
- `/app/config/` - DocuSeal, Baserow configs
- `/app/terraform/` - Azure infrastructure
- `/app/.github/workflows/` - CI/CD pipelines
