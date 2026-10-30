# 📚 `PuddySqlEngine` Class Documentation

A lightweight class for managing SQL engine state and basic query methods in a pluggable and validated manner.

---

## 🔐 Private Properties

### `#sqlEngine: string`

Holds the SQL engine identifier used internally by this instance. It's set only once and used for engine-specific behaviors.

---

## 🧪 Methods

### 🔎 `isSqlEngineEmpty(): boolean`

Checks if the SQL engine is undefined, null, or an empty string.

* ✅ **Returns**: `true` if not set or empty, otherwise `false`.

---

### 📥 `setSqlEngine(engine: string): void`

Sets the SQL engine to be used by this instance. Can only be set **once**, and only with a valid non-empty string.

* 📌 **Parameters**:

  * `engine` *(string)*: Name of the SQL engine, e.g. `'sqlite3'`, `'postgre'`.
* ⚠️ **Throws**:

  * If already set.
  * If provided value is not a valid non-empty string.

---

### 📤 `getSqlEngine(): string`

Returns the currently set SQL engine.

* ✅ **Returns**: SQL engine name.
* ⚠️ **Throws**: If engine is not set.

---

### ❌ `isConnectionError(err: object): boolean`

Detects if a given error matches known SQL engine-specific connection issues.

* 📌 **Parameters**:

  * `err` *(object)*: Error-like plain object to check (e.g. the caught error).
* ⚠️ **Throws**: `TypeError` if `err` is not a plain object.
* 🔍 **Behavior**:

  * For **PostgreSQL**, checks for known error codes like:

    * `ECONNREFUSED`, `ENOTFOUND`, `EHOSTUNREACH`, `ETIMEDOUT`, `EPIPE`, `28P01`, `3D000`, `08006`, `08001`, `08004`, `53300`, `57P01`.
  * For **SQLite3**, checks if the error message includes `SQLITE_CANTOPEN`.
* ✅ **Returns**: `true` if a known connection error is detected.

---

## ⚙️ Query Methods

These methods are placeholders but follow the async query signature.

### 📄 `all(query: string, params?: any[], debugName?: string): Promise<any[]>`

Executes an SQL `SELECT` query expected to return **multiple rows**.

* 📌 **Parameters**:

  * `query`: SQL string.
  * `params`: Optional array of parameters.
  * `debugName`: Optional debug label.
* ✅ **Returns**: Array of row results.
* ⚠️ **Throws**: On query failure.

---

### 📄 `get(query: string, params?: any[], debugName?: string): Promise<object|null>`

Executes an SQL `SELECT` query expected to return **a single row**.

* 📌 **Parameters**:

  * `query`: SQL string.
  * `params`: Optional array of parameters.
  * `debugName`: Optional debug label.
* ✅ **Returns**: Single result object or `null`.
* ⚠️ **Throws**: On query failure.

---

### ✏️ `run(query: string, params: any[], debugName?: string): Promise<object|null>`

Executes an SQL `INSERT`, `UPDATE`, or `DELETE` statement.

* 📌 **Parameters**:

  * `query`: SQL string.
  * `params`: Parameters to bind.
  * `debugName`: Optional debug label.
* ✅ **Returns**: Result object or `null`.
* ⚠️ **Throws**: On execution failure.

---

## 🚀 Export

```js
export default PuddySqlEngine;
```

This class is ready to be used as a foundational SQL abstraction for SQLite3, PostgreSQL, and others with minimal setup.
