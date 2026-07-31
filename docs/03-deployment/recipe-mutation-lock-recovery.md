# Recipe mutation lock recovery

Recipe edits and guidance publication use persistent owner locks in the
`recipe_mutation_locks` Mongo collection. A lock is intentionally retained when a target write has
an ambiguous outcome, and a successful request reports an error if its owner-scoped release fails.
An ambiguous acquisition is read back using its exact owner token; if that cannot prove ownership,
the request fails closed and logs the recipe ID and owner token needed to locate a lock that may
appear later. This prevents another writer from overlapping an operation that might still complete.

## Recovery authority

Recovery is a production-data operation. It requires explicit operator approval and must not be
automated from an application request. Never clear a lock merely because `acquiredAt` is old.

## Evidence required before clearing

1. Identify the affected recipe ID and read its lock record, including `_id`, `ownerToken`, `fence`,
   and `acquiredAt`.
2. Confirm the process or request that owned the token is stopped and cannot resume its Mongo write.
3. Determine the target-write outcome by reading the recipe and relevant guidance version. Record
   their `updatedAt`, status, and recipe revision before changing the lock.
4. Obtain explicit approval for the production-data update.

## Owner-scoped release

Use the exact `_id`, `ownerToken`, and `fence` observed during the evidence step. The recovery update
must be equivalent to:

```javascript
db.recipe_mutation_locks.updateOne(
  { _id: recipeId, ownerToken: observedOwnerToken, fence: observedFence },
  { $unset: { ownerToken: "", acquiredAt: "" } }
)
```

Require `matchedCount: 1`. A zero match means ownership changed; stop without retrying against a
broader predicate. After release, retry the original user action from a fresh read and record the
outcome in the incident or Baton task.
