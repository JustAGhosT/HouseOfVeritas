# Assess Vertical Feature Completeness

Read the agent definition at `.claude/agents/veritas-journey.md` and trace each business feature across the full stack.

## Instructions

1. Read `.claude/agents/veritas-journey.md` for the full checklist
2. For each of the 11 features listed, check presence at every layer:
   - UI Component (page/form/display)
   - API Route (Next.js handler)
   - Service Layer (lib/services/\*)
   - Data/Storage (Baserow/Blob/PostgreSQL)
   - Azure Function (background processing)
   - Infrastructure (Terraform resource)
   - Testing (unit + E2E coverage)
   - CI/CD (pipeline coverage)
3. Mark each cell as COMPLETE, PARTIAL, or MISSING
4. Identify the most impactful gaps
5. Write your findings to `.claude/reports/vertical-features-report.md`
6. Return a brief summary of the most critical cross-stack gaps

Focus on: features that are partially implemented - present in some layers but missing in others.
