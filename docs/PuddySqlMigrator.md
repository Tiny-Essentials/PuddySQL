# 🚚 `PuddySqlMigrator` Class

Manages database schema versioning and migrations for a [`PuddySqlInstance`](./PuddySqlInstance.md).

A single version number is stored in a dedicated table (default: `puddy_migrations`). Each time
`start(targetVersion)` is called, every registered migration with a version greater than the
current one (and less than or equal to `targetVersion`) runs in ascending order.

---

## 🧠 Constructor

```js
new PuddySqlMigrator(db, tableName = 'puddy_migrations')
```

| Parameter   | Type               | Default              | Description                                     |
| ----------- | ------------------ | -------------------- | ----------------------------------------------- |
| `db`        | `PuddySqlInstance` | —                    | The database instance the migrations run against. |
| `tableName` | `string`           | `'puddy_migrations'` | Table used to store the current schema version.  |

> 💡 You normally don't need to instantiate this class yourself. Use the `migrator` getter on
> `PuddySqlInstance`:
>
> ```js
> const db = new PuddySql.Instance();
> db.migrator.addMigration(1, async (db) => { /* ... */ });
> ```

---

## 🔧 Internal Properties

* `#db`: The `PuddySqlInstance` this migrator belongs to.
* `#tableName`: Name of the version-tracking table.
* `#migrations`: `Map<number, Function>` of registered migrations.

---

## ➕ `addMigration(version, callback): void`

Registers a migration callback for a specific version.

| Parameter  | Type                          | Description                                        |
| ---------- | ----------------------------- | -------------------------------------------------- |
| `version`  | `number`                      | The version number this migration belongs to.      |
| `callback` | `(db: PuddySqlInstance) => Promise<void>` | Async function containing the migration logic. |

**Throws:**

* `TypeError` if `version` is not a valid number.
* `TypeError` if `callback` is not a function.

```js
const users = await db.initTable({ name: 'users', id: 'id' }, [
  ['id', 'INTEGER', 'PRIMARY KEY'],
  ['name', 'TEXT'],
]);

db.migrator.addMigration(1, async () => {
  await users.updateTable([['ADD', 'email', 'TEXT']]);
});
```

---

## 🚀 `start(targetVersion): Promise<void>`

Runs all pending migrations up to `targetVersion`.

1. Ensures the version table exists (creating it and inserting version `0` when needed).
2. Reads the current version.
3. Runs every registered migration where `currentVersion < version <= targetVersion`, in ascending order.
4. Persists the new version after each successful migration.

If `targetVersion` is less than or equal to the current version, the method resolves immediately.

**Throws:**

* `Error` if any migration throws. The error message includes the failing version and the original
  message, and the `Migration-Error` event is emitted.

> ⚠️ **IMPORTANT:** Call this method only after ensuring that the base tables of your project
> have already been verified/created.

---

## 📡 Events

All events are emitted on the `PuddySqlInstance` (which extends `EventEmitter`). Use the constants
from `PuddySqlEvents`:

| Constant                    | Value                  | Payload                    |
| --------------------------- | ---------------------- | -------------------------- |
| `PuddySqlEvents.MigrationStarting`  | `'Migration-Starting'`  | `version: number`          |
| `PuddySqlEvents.MigrationCompleted` | `'Migration-Completed'` | `version: number`          |
| `PuddySqlEvents.MigrationFinished`  | `'Migration-Finished'`  | —                          |
| `PuddySqlEvents.MigrationError`     | `'Migration-Error'`     | `{ version, error }`       |

```js
import PuddySql from 'puddysql';
import PuddySqlEvents from 'puddysql/Events';

const db = new PuddySql.Instance();

db.on(PuddySqlEvents.MigrationStarting, (version) =>
  console.log(`Starting migration ${version}...`),
);
db.on(PuddySqlEvents.MigrationError, ({ version, error }) =>
  console.error(`Migration ${version} failed:`, error),
);

await db.startMigration(3);
```

---

## 🧪 Full Example

```js
import PuddySql from 'puddysql';

const db = new PuddySql.Instance();
await db.initSqlite3();

const users = await db.initTable({ name: 'users', id: 'id' }, [
  ['id', 'INTEGER', 'PRIMARY KEY'],
  ['name', 'TEXT'],
]);

db.migrator.addMigration(1, async () => {
  await users.updateTable([['ADD', 'email', 'TEXT']]);
});

db.migrator.addMigration(2, async () => {
  await users.updateTable([['ADD', 'created_at', 'TEXT']]);
});

await db.startMigration(2);
```
