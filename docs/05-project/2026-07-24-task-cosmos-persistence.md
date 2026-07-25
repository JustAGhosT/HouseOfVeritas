# Task Persistence on the Existing Cosmos Store

## Context

The authenticated production verification for PR #129 found that task creation was not durable
when Baserow was unconfigured. `POST /api/tasks` returned a generated task object, but the immediate
`GET /api/tasks` returned an empty list. That made task-guidance attach and reopen impossible even
though production already had a configured Cosmos Mongo connection for guidance and inventory.

## Decision

Keep Baserow as the task source when its tasks table is configured. Otherwise:

- use the existing `MONGODB_URI` / `DB_NAME` connection and a `tasks` collection;
- route both list/mutation operations and individual task authorization lookups through it;
- preserve the existing empty/demo behavior when neither Baserow nor Mongo is configured;
- report `dataSource: "mongodb"` and `configured: true` from the tasks API;
- keep task IDs numeric for compatibility with existing UI, workflow, and access contracts.

No new datastore or infrastructure is introduced.

The production Cosmos account exposes the MongoDB 3.6 protocol (wire version 6). Keep the Node
MongoDB driver on the latest 5.x release (`5.9.2`) unless the account is upgraded: driver 7.x
requires MongoDB 4.2 / wire version 8 and fails topology selection before any query can run.
The `tasks` collection also requires the compound `{ createdDate: -1, id: -1 }` index used by the
default task-list sort; Cosmos does not serve that sort from the separate single-field indexes.

## Verification

Run:

```text
pnpm run lint
node .\node_modules\vitest\vitest.mjs run tests/lib/task-repository.test.ts tests/lib/baserow-task-store.test.ts tests/api/tasks.test.ts tests/lib/baserow.test.ts
node .\node_modules\typescript\bin\tsc --noEmit --incremental false
pnpm run build
```

After deployment, create one clearly labeled Irma task, refresh the resident task list, attach
visual guidance, close and reopen the dialog, and then remove the verification artifacts.
