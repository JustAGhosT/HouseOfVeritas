# Security Audit

Focused security scan of the entire codebase.

## Instructions

Read `.claude/rules/security.md` for the security standards, then:

1. **Secrets scan**: Search for hardcoded API keys, passwords, tokens, connection strings
   - Scan `lib/`, `app/`, `config/`, `terraform/`, `.env*` for patterns like `password =`,
     `secret =`, `token =`, `apiKey =`, `PASSWORD=`, `SECRET_KEY=`, `API_TOKEN=`
   - Check `.env.example` documents all required secrets
   - Verify no `.env.local` or `.tfvars` files are committed

2. **Auth coverage**: Verify every non-public API route has auth checks
   - List all routes in `app/api/`
   - Check `middleware.ts` (or `proxy.ts` if migrated to Next.js 16) for public path definitions
   - Flag any route missing `withAuth()`, `withRole()`, or `getAuthContext()` check

3. **Input validation**: Check all POST/PUT/PATCH routes validate request bodies
   - Flag routes that call `request.json()` without validation
   - Flag routes that pass user input directly to external APIs

4. **Dependency audit**: Run `pnpm audit` and report vulnerabilities

5. **Terraform security**:
   - Check NSG rules for overly permissive access
   - Verify WAF rules are enabled
   - Check for public endpoints that should be private

Write findings to `.claude/reports/security-audit-report.md` with severity levels.
