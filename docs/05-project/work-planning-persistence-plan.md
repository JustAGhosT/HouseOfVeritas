# Work Planning Persistence Plan

## Current MVP

The work-planning UI now treats a top-level scope as a site, asset, or location, and treats each child record as a job. A job can contain areas, grouped tasks, and material or labour allocations. For this PR the compatibility layer keeps the existing stored project types (`major` and `subproject`) while exposing the clearer `scope` and `job` language in the UI and API responses.

The new job workspace stores early metadata in JSON files under `data/`:

- `job-areas.json` for rooms, zones, components, and other job-local areas.
- `job-task-groups.json` for task-to-area and task-to-group metadata while task ownership remains in the existing task service.
- `job-allocations.json` for material and labour allocations tied to a job and optionally to an area.

This is acceptable for the slice because it keeps the workflow testable without forcing a database migration before the data model is settled. It is not the long-term production persistence shape.

## Durable Store Shape

Move these records into the operational data store once the UI workflow has settled:

| Entity | Ownership | Required fields | Notes |
| --- | --- | --- | --- |
| Work scope | Global dashboard planning | `id`, `name`, `category`, `status` | Category is `site`, `asset`, or `location`; retain legacy type migration from `major` to `scope`. |
| Job | Belongs to one scope | `id`, `scopeId`, `name`, `status` | Represents work such as bathroom repair, fishpond renovation, vehicle service, or farm job. |
| Job area | Belongs to one job | `id`, `jobId`, `name`, `kind` | Kind remains flexible: room, area, component, zone. |
| Job task metadata | Belongs to one job and existing task | `taskId`, `jobId`, optional `areaId`, optional `groupName` | Keep canonical task fields in the existing task table/service. |
| Job allocation | Belongs to one job | `id`, `jobId`, `type`, `name`, costing fields | `type` is material or labour; area link is optional. |

## Migration Steps

1. Add durable tables or Baserow tables for job areas, task metadata, and allocations.
2. Backfill from the JSON files in an explicit one-time script that can be run in dry-run mode.
3. Switch API route storage behind a repository module so JSON remains available only for local fallback or migration replay.
4. Add route tests at the repository boundary and browser smoke coverage for `/dashboard/hans/projects` and `/dashboard/hans/projects/[id]`.
5. Remove JSON writes from production mode once the durable store is live and verified.

## Verification Baseline

The PR includes unit coverage for project type aliases and API route coverage for job areas, allocations, and grouped task metadata. Browser verification should still be run against an authenticated environment before production rollout because the header scope selector and job workspace are navigation-heavy UI changes.
