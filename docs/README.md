# 🍮 PuddySQL Toolkit

Welcome to the **PuddySQL** ecosystem — a modular toolkit for building advanced SQL query layers with clarity, safety, and full control over dynamic data access.

Whether you're creating dashboards, data explorers, or just want a smarter SQL abstraction, PuddySQL gives you the tools to do it *your way*.

## 📚 Modules Overview

Choose a module to explore:

- [`PuddySqlEngine.md`](./PuddySqlEngine.md)  
  🔧 Low-level query engine responsible for core execution, debugging, and database access management.

- [`PuddySqlInstance.md`](./PuddySqlInstance.md)  
  🧠 Extends the engine to manage per-database configurations, table registries, and styled debug output.

- [`PuddySqlQuery.md`](./PuddySqlQuery.md)  
  📊 High-level query handler for filtering, JOINs, pagination, tag criteria, and structured search logic.

- [`PuddySqlTags.md`](./PuddySqlTags.md)  
  🏷️ Tag parser and translator for building flexible tag-based filters compatible with JSON/array fields.

- [`PuddySqlMigrator.md`](./PuddySqlMigrator.md)  
  🚚 Version-based migration runner, available through `instance.migrator` / `instance.startMigration()`.

- **`PuddySqlEvents`** (`puddysql/Events`)  
  🎯 Static class holding every event name emitted by the library (`Connection-Error`, `Migration-*`).
  Also exposes `PuddySqlEvents.all` and `PuddySqlEvents.isValid(event)`.

---

## 🧭 Entry Point

The default export exposes every module as a static property:

```js
import PuddySql from 'puddysql';

PuddySql.Instance; // PuddySqlInstance
PuddySql.Query;    // PuddySqlQuery
PuddySql.Tags;     // PuddySqlTags
PuddySql.Events;   // PuddySqlEvents
PuddySql.Migrator; // PuddySqlMigrator
PuddySql.Utils;    // Utility helpers
PuddySql.pg;       // PostgreSQL driver wrapper
PuddySql.sqlite3;  // SQLite3 driver wrapper
```

---

> You can mix and match them as needed — everything is modular and documented in detail.
