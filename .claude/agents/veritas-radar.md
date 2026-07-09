# Veritas Radar

## Role

Specialized agent for finding bugs, incomplete features, edge cases, and enhancement opportunities.
Combines static analysis thinking with runtime scenario evaluation.

## Scope

```text
(entire codebase)
app/
lib/
components/
middleware.ts
config/azure-functions/
public/
```

## Checklist

### Bug Categories

#### Security Bugs

- [ ] JWT secret fallback to hardcoded value in production
- [ ] Rate limiter in-memory store lost on restart (no persistence)
- [ ] Password reset without email verification
- [ ] Session not invalidated on password change
- [ ] CSRF protection on state-changing endpoints
- [ ] XSS vectors in user-generated content rendering

#### Logic Bugs

- [ ] Race conditions in concurrent data updates
- [ ] Off-by-one errors in pagination
- [ ] Timezone handling in date comparisons
- [ ] Floating-point arithmetic for monetary values
- [ ] Null/undefined not handled on optional chains
- [ ] Promise rejections without catch handlers

#### Integration Bugs

- [ ] Baserow API token expiry not handled
- [ ] DocuSeal webhook signature verification missing
- [ ] Storage SAS token expiry during long uploads
- [ ] Network timeout defaults too low/high
- [ ] Retry logic missing on transient failures

#### UI Bugs

- [ ] Forms submittable with invalid data
- [ ] Loading states not shown during async operations
- [ ] Error messages not cleared after retry
- [ ] Browser back button breaks navigation state
- [ ] Mobile viewport issues

### Feature Completeness

#### Authentication

- [ ] Forgot password flow (email-based)
- [ ] Account lockout after N failed attempts
- [ ] Session management UI (view active sessions)
- [ ] Multi-factor authentication
- [ ] Password complexity requirements enforced client-side

#### Dashboard

- [ ] Real-time data refresh (polling or WebSocket)
- [ ] Dashboard customization (widget arrangement)
- [ ] Date range filters on charts/stats
- [ ] Export data to CSV/PDF
- [ ] Print-friendly views

#### Document Management

- [ ] Document upload progress indicator
- [ ] Document preview (PDF viewer)
- [ ] Document version history
- [ ] Batch document operations
- [ ] Document search/filter

#### Notifications

- [ ] In-app notification center
- [ ] Push notifications (web push)
- [ ] Email notification preferences per user
- [ ] SMS notification opt-in/opt-out

#### Reporting

- [ ] Scheduled report delivery via email
- [ ] Custom date range reports
- [ ] Report templates
- [ ] Chart/graph visualizations

### Enhancement Opportunities

- [ ] API response caching (Redis or in-memory with TTL)
- [ ] Optimistic UI updates
- [ ] Keyboard shortcuts for power users
- [ ] Activity feed / audit trail UI
- [ ] Bulk operations (multi-select actions)
- [ ] Full-text search across entities
- [ ] Internationalization (i18n) preparation
- [ ] Analytics / usage tracking

## Output Format

Write findings to `.claude/reports/bugs-enhancements-report.md` with severity (P0-P3),
type (BUG/FEATURE/ENHANCEMENT), and estimated effort.
