# 📊 PuddySqlQuery

`PuddySqlQuery` is a high-level query builder class for managing SQL tables using flexible filters, tag-based conditions, JOINs, pagination, and result validation.

It supports complex nested logic (AND/OR), dynamic tag filtering, composable JOIN structures, and automatic SQL clause generation — all while keeping the API intuitive and extensible.

Perfect for advanced search interfaces, dashboards, data exploration tools, or any project that needs powerful yet readable SQL control.

---

## 🗃️ Core Types & Initialization

### 🧩 SqlTableConfig  
Defines the schema structure for programmatic SQL table creation or modification.  
Each array entry represents a single column with this 4-item tuple format:  
`[columnName, columnType, columnOptions, columnMeta]`  
- **columnName** (`string`): Name of the column, e.g., `"id"`, `"username"`.  
- **columnType** (`string`): SQL data type, e.g., `"TEXT"`, `"INTEGER"`.  
- **columnOptions** (`string`): SQL options like `NOT NULL`, `PRIMARY KEY`, `DEFAULT`.  
- **columnMeta** (`any`): Arbitrary metadata (UI hints, descriptions, tags).  

---

### 🔎 FindResult  
Result of a paginated SQL query locating a specific item:  
- **page** (`number`): Current page number (starting at 1).  
- **pages** (`number`): Total pages available.  
- **total** (`number`): Total items in dataset.  
- **position** (`number`): Exact item index (starting at 0).  
- **item** (`FreeObj` | optional): The actual found item, if returned.  

---

### 🏷️ TagCriteria  
Definition for tag group filtering in SQL clauses:  
- **group.column** (`string` | optional): SQL column for tag data (default: `this.getColumnName()`).  
- **group.tableName** (`string` | optional): Table name used (default: `this.defaultTableName`).  
- **group.allowWildcards** (`boolean` | optional): Allow wildcards in matching (default: `false`).  
- **group.include** (`Array<string|string[]>`): Tag values or OR-groups to include in filtering.  

---

### 📄 PaginationResult  
Result object for paginated queries:  
- **items** (`any[]`): Array of items returned for current page.  
- **totalPages** (`number`): Total available pages.  
- **totalItems** (`number`): Total matching items without pagination.  

---

### 🎯 SelectQuery  
Flexible input for SELECT clause:  
Can be a `string`, array of strings, or object with:  
- `aliases` (mapping display names to real columns)  
- `values` (array of columns to select)  
- `boost` (weighted ranking configuration with alias and boost rules)  
Can also be `null` for defaults.  

---

### 🧰 Pcache  
Parameter cache for building WHERE clauses:  
- `index` (`number`): Starting index for SQL placeholders (`$1`, `$2`, ...). Defaults to `1`.  
- `values` (`any[]`): Values collected for parameter binding.  

---

### 📦 FreeObj  
Generic object with arbitrary keys and unknown values:  
- Keys can be `string`, `number`, or `symbol`.  
- Values are of unknown type. Useful for flexible data containers.  

---

### ⚖️ WhereConditions  
Conditions used in SQL WHERE clause:  
- `group` (`'AND'|'OR'|'and'|'or'` | optional): Logical operator for condition groups.  
- `conditions` (array of `WhereConditions` or `QueryGroup` | optional): Nested logical conditions.  
- `funcName`, `operator`, `value`, `valType`, `lPos`, `newOp`, `column` (various optional fields for SQL expressions and chaining).  

---

### 🧩 QueryGroup  
Flexible group of WHERE conditions, supporting either:  
1. Single condition object:  
```js
{ column: 'name', operator: '=', value: 'pudding' }
````

2. Named group of conditions:

```js
{
  searchByName: { column: 'name', operator: 'ILIKE', value: '%fluttershy%' },
  searchByType: { column: 'type', operator: '=', value: 'pegasus' }
}
```

Enables dynamic grouping for advanced filters and scoped searches.

---

### 🚀 BoostValue

Rule for weighted query boosting:

* `columns` (optional array): Columns to apply boost on.
* `operator`: Condition operator. Only `'LIKE'`, `'ILIKE'` or `''` are accepted (default `''`).
* `value`: Value or array of values to match. When `columns` is omitted, it must be a raw SQL condition string.
* `array` (optional boolean, default `false`): When `true`, matches against a JSON/array column using `json_each()`.
* `weight`: Numeric factor to boost matched results (default `1`).

---

### 🔗 JoinObj

Object defining SQL JOIN clauses:

* `table` (`string`): Table name to join.
* `compare` (`string`): ON clause condition.
* `type` (`string` | optional): JOIN type, defaults to `'left'`.

---

### 🏛️ TableSettings

Settings for SQL table/entity configuration:

* `name` (optional string): Table or view name.
* `select` (`SelectQuery`): SELECT clause config. Defaults to `"*"`.
* `join` (optional string): JOIN table name.
* `joinCompare` (optional string): JOIN condition, e.g. `'t.key = j.key'`.
* `order` (optional string): ORDER BY clause.
* `id` (`string`): Primary key column. Defaults to `'key'`.
* `subId` (optional string): Secondary key column (composite key or scope).

---

### ⚙️ Settings

Configuration for SQL entity querying and joining:

* `select` (`string`): Default columns to select.
* `name` (`string`): Main table/view name.
* `id` (`string`): Primary key column name.
* `joinCompare` (optional string): JOIN matching condition.
* `order` (optional string): Default ordering clause.
* `subId` (optional string): Secondary ID column.
* `join` (optional string): JOIN clause (e.g., `"LEFT JOIN profiles ON ..."`).

---

### 🔧 WhereConditionsFunc

Function type that takes and returns a `WhereConditions` object.
Used for SQL WHERE clause transformations or appends.

---

### 🗂️ SqlConditions

Map of named condition identifiers to their transformation functions (`WhereConditionsFunc`).

---

### 🏗️ PuddySqlQuery Class Overview

The main query engine for operating on a specific SQL table with support for dynamic conditions, tags, joins, and advanced query building.

#### Private fields:

* `#conditions`: Registered SQL conditions map.
* `#customValFunc`: Custom value transformation functions.
* `#db`: The internal `PuddySqlEngine` database instance.
* `#settings`: Current table/query settings.
* `#table`: Table schema and column metadata.
* `#tagColumns`: Tag filtering helpers per column.
* `#columns`: The raw column definition array passed to the constructor.
* `#columnsQuery`: The generated `CREATE TABLE IF NOT EXISTS` statement.
* `#resultCounts`: Maps each engine to the property holding the affected row count.
* `#joinTypes`: Maps JOIN type aliases to their SQL keywords.

---

#### Getter: `db`

Returns the internal database instance (`PuddySqlEngine`).

```js
const db = instance.db;
```

---

#### Getter: `columns`

Returns a deep clone of the column definition array used to build the table.

```js
const columns = instance.columns;
```

---

## ⚙️ Constructor & Condition Management

### 🚀 Constructor: `new PuddySqlQuery({ columns, db, settings })`

Builds the table schema (the `CREATE TABLE IF NOT EXISTS` statement), stores the column
metadata and registers all built-in SQL conditions. There is no `createTable()` or `setDb()`
anymore — everything is configured through the constructor, and the table is only created in
the database when `initTable()` is called.

- `columns` (`SqlTableConfig`): Array of column definitions.
- `db` (`PuddySqlEngine`): The database instance (must extend `PuddySqlEngine`).
- `settings` (`TableSettings`): Table settings, including the required `name`.

**Throws:** `TypeError` when `columns` is not an array, `settings` is not a plain object or
`db` is not a `PuddySqlEngine`; `Error` when `settings.name` is missing.

---

### 🚀 Initial Condition Setup
The constructor also initializes the query instance with a set of predefined SQL condition operators and function-based conditions.

- Adds common operators like `'LIKE'`, `'NOT'`, `'='`, `'!='`, `'>='`, `'<='`, `'>'`, `'<'`.
- Registers advanced SQL functions using `addConditionV2` for phonetic, string, math, and date/time functions:
  - Phonetic: `SOUNDEX`
  - Case conversion: `LOWER`, `UPPER`
  - Trim whitespace: `TRIM`, `LTRIM`, `RTRIM`
  - String length: `LENGTH`
  - Math: `ABS`, `ROUND`, `CEIL`, `FLOOR`
  - Null handling: `COALESCE`
  - String formatting: `HEX`, `QUOTE`
  - Unicode: `UNICODE`, `CHAR`
  - Type inspection: `TYPEOF`
  - Date/time extraction: `DATE`, `TIME`, `DATETIME`, `JULIANDAY`

---

### 🔍 Method: `hasCondition(key)`  
Checks if a condition is registered under the given key.

- **Parameters:**  
  - `key` (`string`): Condition identifier.

- **Returns:**  
  - `boolean`: `true` if condition exists, else `false`.

---

### 🛠️ Method: `getCondition(key)`  
Retrieves the condition function registered with the given key.

- **Parameters:**  
  - `key` (`string`): Condition identifier.

- **Returns:**  
  - `WhereConditionsFunc`: The condition function.

- **Throws:**  
  - `Error` if condition key is not found.

---

### 📋 Method: `getConditions()`  
Returns a shallow copy of all registered condition functions.

- **Returns:**  
  - `SqlConditions` — Object mapping keys to condition functions.

---

### ➕ Method: `addCondition(key, conditionHandler, valueHandler = null)`  
Registers a new condition type for query generation.

- **Parameters:**  
  - `key` (`string`): Unique identifier for the condition.  
  - `conditionHandler` (`string` | `WhereConditions` | `WhereConditionsFunc`):  
    Defines the condition logic.  
    - String: SQL operator (e.g., `'='`, `'LIKE'`)  
    - Object: Must include `.operator` (e.g., `{ operator: '>=' }`)  
    - Function: Custom condition builder function.  
  - `valueHandler` (`function(string): string` | `null`): Optional function transforming parameter values (e.g., for `SOUNDEX`).

- **Validation:**  
  - Throws if `key` is not a non-empty string.  
  - Throws if `key` already exists in conditions or value handlers.  
  - Throws if `conditionHandler` is not valid type.  
  - Throws if `valueHandler` is provided but not a function.

- **Behavior:**  
  - Stores `conditionHandler` internally (function wrapped if string or object).  
  - Stores `valueHandler` if provided.

---

### 🎯 Method: `addConditionV2(funcName, editParamByDefault = false, operator = '=')`  
Registers a SQL function-based condition with optional parameter transformation.

- **Purpose:**  
  Wraps a SQL column in a function (e.g., `LOWER(column)`) and optionally applies the same function to the parameter (`LOWER($1)`).

- **Parameters:**  
  - `funcName` (`string`): SQL function name (must be non-empty).  
  - `editParamByDefault` (`boolean`, default `false`): If `true`, applies function to the query parameter by default.  
  - `operator` (`string`, default `'='`): SQL comparison operator.

- **Runtime Behavior:**  
  - Uses `group.newOp` if provided to override operator.  
  - Uses `group.funcName` if provided to override function name in SQL and value transformation.  
  - Final SQL resembles: `FUNC(column) OP FUNC($n)` or `FUNC(column) OP $n` depending on `editParamByDefault`.

- **Throws:**  
  - `TypeError` if parameters are invalid types or empty strings.

- **Example Usages:**  
  - Registering ROUND with operator `!=`:  
    ```js
    addConditionV2('ROUND', false, '!=');
    ```  
  - Registering LOWER with parameter function:  
    ```js
    addConditionV2('LOWER', true);
    // Parses: LOWER(username) = LOWER($1)
    ```  
  - Registering UPPER without parameter function:  
    ```js
    addConditionV2('UPPER');
    // Parses: UPPER(username) = $1
    ```  
  - Overriding operator at runtime:  
    ```js
    addConditionV2('CEIL', true);
    parse({
      column: 'price',
      value: 3,
      newOp: '>',
      operator: 'CEIL',
      funcName: null
    });
    // Result: CEIL(price) > 3
    ```

---

## 🧩 selectGenerator & JSON Helpers

### 🎯 Method: `selectGenerator(input = '*')`  
Generates a SQL SELECT clause from flexible input formats, supporting aliases, complex expressions, and weighted boosts via CASE statements.

#### Supported input types:
- `null` / `undefined`: returns `'*'`
- `string`: returns the parsed column or SQL expression (supports aliases with `AS`)
- `string[]`: returns a comma-separated list of parsed columns
- `object`: supports structured input with:
  - `aliases`: key-value pairs for columns and aliases
  - `values`: array of column names or expressions
  - `boost`: weighted relevance using CASE, with rules for columns, operators, values, and weights

#### Boost rules support:
- `columns` (optional): single string or array of strings (target columns)
- `value`: string or array (value(s) to compare) or raw SQL condition if `columns` omitted
- `operator`: SQL operator (default `'LIKE'`, supports `'IN'`, `'='`, etc.)
- `weight`: numeric weight applied on match (default `1`)

> All values are escaped using `pg.escapeLiteral()` for PostgreSQL safety.

#### Throws:
- `TypeError` for invalid input types
- `Error` if `boost.alias` is missing or invalid
- `Error` if `boost.value` exists but is not an array

#### Examples:
```js
selectGenerator(); 
// returns '*'

selectGenerator('COUNT(*) AS total'); 
// returns 'COUNT(*) AS total'

selectGenerator(['id', 'username']); 
// returns 'id, username'

selectGenerator({
  aliases: { id: 'image_id', uploader: 'user_name' },
  values: ['created_at', 'score']
});
// returns 'id AS image_id, uploader AS user_name, created_at, score'

selectGenerator({
  aliases: { id: 'image_id', uploader: 'user_name' },
  values: ['created_at'],
  boost: {
    alias: 'relevance',
    value: [
      { columns: ['tags', 'description'], value: 'fluttershy', weight: 2 },
      { columns: 'tags', value: 'pinkie pie', operator: 'LIKE', weight: 1.5 },
      { columns: 'tags', value: 'oc', weight: -1 },
      { value: "score > 100 AND views < 1000", weight: 5 }
    ]
  }
});
// returns CASE statement boosting relevance + other columns
```

---

### 🧩 Method: `parseColumn(column, alias)`

Parses an individual column or SQL expression, optionally applying an alias.

* `column` (`string`): Column name or SQL expression
* `alias` (`string`, optional): Alias name

**Returns:** SQL snippet like `"column"` or `"column AS alias"`

**Throws:**

* `TypeError` if inputs are not strings

---

### 🔧 JSON SQL Helpers

These methods help generate SQLite-compatible JSON queries:

#### `#sqlOpStringVal(value)`

Internal helper that asserts the input is a string and returns it.

---

#### `getJsonExtract(where, name)`

Generates SQLite JSON extraction snippet:

```sql
json_extract(where, '$.name')
```

* `where` (`string`): JSON column or expression
* `name` (`string`): Key or JSON path

---

#### `getJsonEach(source)`

Generates SQLite `json_each` call to expand JSON arrays or objects into rows:

```sql
json_each(source)
```

* `source` (`string`): JSON column or expression

---

#### `getArrayExtract(where, name)`

Combines `getJsonExtract` and `getJsonEach` to expand a JSON array from a specific key:

```sql
json_each(json_extract(where, '$.name'))
```

* `where` (`string`): JSON column
* `name` (`string`): Key containing array

---

#### `getJsonCast(where, name, type)`

Extracts a JSON value and casts it to a specified SQLite type:

```sql
CAST(json_extract(where, '$.name') AS TYPE)
```

* `where` (`string`): JSON column
* `name` (`string`): Key to extract
* `type` (`string`): SQLite type to cast to (e.g., `'INTEGER'`, `'TEXT'`, `'REAL'`)

---

## 🛠️ Table Schema Management & Tag Editors 

### 🔄 Method: `async updateTable(changes)`  
Updates a SQL table schema by adding, removing, modifying, or renaming columns.

#### Parameters:
- `changes` (`SqlTableConfig`): Array of change commands, each an array:
  - `['ADD', columnName, columnType, columnOptions?]`
  - `['REMOVE', columnName]`
  - `['MODIFY', columnName, newColumnType, newOptions?]`
  - `['RENAME', oldColumnName, newColumnName]`

#### Behavior:
- Executes corresponding `ALTER TABLE` SQL statements.
- Uses `this.db` for DB access.
- Throws on invalid input.
- Logs errors if DB operations fail but continues.

#### Throws:
- `TypeError` if `changes` is not an array of arrays or invalid action.
- `Error` if required parameters for each action are missing or invalid.

---

### 💥 Method: `async dropTable()`  
Drops the current table if it exists.

#### Returns:
- `Promise<boolean>`: resolves `true` on success, `false` on failure (except connection errors, which reject).

#### Behavior:
- Runs `DROP TABLE {tableName}`.
- Uses connection error detection to reject or resolve accordingly.

---

### 🏗️ Method: `async initTable()`
Creates the table in the database using the schema built by the constructor.


#### Behavior:
- Executes the `CREATE TABLE IF NOT EXISTS` statement generated in the constructor.
- Stores the column schema in `this.#table` with uppercase types and options.
- Creates `PuddySqlTags` instances for `"TAGS"` columns stored in `this.#tagColumns`.
- Throws on invalid definitions or missing table name.

---

### 🔖 Method: `hasTagEditor(name)`  
Checks if a column has an associated tag editor (`PuddySqlTags` instance).

#### Parameters:
- `name` (`string`): Column name.

#### Returns:
- `boolean` — `true` if tag editor exists, `false` otherwise.

---

### 🔍 Method: `getTagEditor(name)`  
Retrieves the `PuddySqlTags` instance for a specific tag column.

#### Parameters:
- `name` (`string`): Column name.

#### Returns:
- `PuddySqlTags` instance.

#### Throws:
- `Error` if the column has no associated tag editor or invalid input.

---

### 📋 Getter: `tagColumns`
Returns all tag editors as a shallow copy object mapping column names to their `PuddySqlTags`.

#### Returns:
- `Record<string, PuddySqlTags>` — All tag editors by column.

```js
const editors = table.tagColumns;
```

---

## 🧪 Data Conversion, Escaping & Settings 

### 🔃 `#jsonEscape` — Type Conversion Utilities

A private map of functions that convert raw SQL values into native JavaScript types.

| Key      | Description |
|----------|-------------|
| `boolean` | Returns `true` for: `true`, `"true"`, `1`, `"1"`. |
| `bigInt`  | Converts values to `BigInt`. Returns `null` on failure. |
| `int`     | Parses to integer (`parseInt`). Returns `null` if NaN. |
| `float`   | Parses to float (`parseFloat`). Returns `null` if NaN. |
| `json`    | Parses JSON strings. Returns original if already object/array. |
| `tags`    | Parses strings to arrays of strings. Invalid elements become `null`. |
| `text`    | Returns the string if it's valid. Otherwise `null`. |
| `date`    | Converts to valid `Date` object. Returns `null` if invalid. |

---

### 🧬 `#jsonEscapeAlias` — SQL Type Mappings

Maps SQL types (e.g., `INTEGER`, `TEXT`, `TAGS`) to their corresponding `#jsonEscape` functions.

Supported aliases include:
- `BOOLEAN`, `BOOL`
- `BIGINT`, `DECIMAL`, `NUMERIC`
- `INTEGER`, `INT`, `SMALLINT`, `TINYINT`
- `REAL`, `FLOAT`, `DOUBLE`
- `TEXT`, `CHAR`, `VARCHAR`, `CLOB`
- `JSON`, `TAGS`
- `DATE`, `DATETIME`, `TIMESTAMP`, `TIME`

---

### ✅ Method: `_resultChecker(result)`

Converts result rows from raw SQL types into properly typed JavaScript values based on `this.#table`.

#### Parameters:
- `result` (`object`) — A result row from the database.

#### Returns:
- `FreeObj` — The same object, converted.

---

### 🛡️ Method: `escapeValues(valueObj)`

Converts values for writing back to the database using type definitions from `this.#table`.

#### Parameters:
- `valueObj` (`FreeObj`) — Object of raw input values.

#### Returns:
- `FreeObj` — The same object, with values sanitized or transformed.

---

### 📊 Private: `#resultCounts`

Maps driver types to the field used to count affected rows:
- `"sqlite3"` → `"changes"`
- `"postgre"` → `"rowCount"`

Used internally to abstract SQL dialect differences.

---

## 🔧 Updates, Inserts & Transformations

### 📊 Method: `getResultCount(result)`

Returns the number of affected rows from a database result, abstracting engine-specific fields.

| Engine       | Field         |
|--------------|---------------|
| `sqlite3`    | `changes`     |
| `postgre`    | `rowCount`    |
| Fallback     | `rowsAffected` |

#### Parameters:
- `result` (`object|null`) — Result from `run()` or query execution.

#### Returns:
- `number` — Affected rows, or `0`.

---

### 🔎 Method: `has(id, subId?)`

Checks if a row exists using primary key (and optional `subId` for composite keys).

#### Parameters:
- `id` (`string|number`) — Primary ID.
- `subId` (`string|number`) — Optional secondary ID.

#### Returns:
- `Promise<boolean>` — `true` if exists.

---

### 🛠️ Private: `#jsonEscapeFix` — Output Transformers

Used when saving data back to SQL.

| Type  | Behavior |
|-------|----------|
| `JSON` | `JSON.stringify(value)` |
| `TAGS` | Ensures all entries are strings before stringifying |

---

### 🔐 Method: `escapeValuesFix(v, name)`

Applies the appropriate fix function for a specific column type before writing.

#### Parameters:
- `v` (`any`) — Value to transform.
- `name` (`string`) — Column name.

#### Returns:
- `any` — Escaped value or original.

---

### 🧬 Method: `advancedUpdate(valueObj, filter)`

Updates one or more rows using a filter object instead of direct IDs.

#### Parameters:
- `valueObj` (`FreeObj`) — Fields to update.
- `filter` (`QueryGroup`) — WHERE clause object.

#### Returns:
- `Promise<number>` — Rows updated.

---

### 🔄 Method: `update(id, valueObj)`

Updates a row using its primary key (`subId` supported if available).

#### Parameters:
- `id` (`string|number`) — Primary ID.
- `valueObj` (`FreeObj`) — Fields to update.

#### Returns:
- `Promise<number>` — Rows updated.

---

### 📥 Method: `set(id, valueObj, onlyIfNew = false)`

Inserts or updates one or more rows. Automatically escapes values and handles generated IDs.

#### Parameters:
- `id` (`string|number|string[]|number[]`) — Primary key(s).
- `valueObj` (`FreeObj|FreeObj[]`) — One or many objects with fields.
- `onlyIfNew` (`boolean`) — If `true`, skips update on conflict.

#### Behavior:
- Uses `ON CONFLICT DO UPDATE` (or `DO NOTHING`)
- Detects auto-generated or primary key columns and returns them.
- Ensures all entries in `valueObj[]` are uniform in keys.

#### Returns:
- `Promise<FreeObj|FreeObj[]|null>` — Inserted or updated row(s), or `null`.

---

### 📥 Method: `add(valueObj)`

Inserts one or more new rows without an explicit primary key. Internally delegates to
`#set(null, valueObj, true)`, so the database generates the key and conflicting rows are
silently skipped (`ON CONFLICT DO NOTHING`).

#### Parameters:
- `valueObj` (`FreeObj|FreeObj[]`) — One or many objects with the fields to insert.

#### Returns:
- `Promise<FreeObj|FreeObj[]|null>` — Generated values, or `null` if nothing was generated.

---

### 📌 Method: `get(id, subId?)`

Fetches a single record using its primary key (and optional `subId` if defined).

#### Parameters:
- `id` (`string|number`) — Primary key.
- `subId?` (`string|number`) — Optional composite key.

#### Returns:
- `Promise<FreeObj|null>` — Record if found, else `null`.

---

### 🗑️ Method: `advancedDelete(filter)`

Deletes records matching a complex filter condition.

#### Parameters:
- `filter` (`QueryGroup`) — Object representing WHERE conditions.

#### Returns:
- `Promise<number>` — Number of rows deleted.

---

### ❌ Method: `delete(id, subId?)`

Deletes a record by primary key (and optional `subId`).

#### Parameters:
- `id` (`string|number`)
- `subId?` (`string|number`)

#### Returns:
- `Promise<number>` — Number of rows deleted.

---

### 🔢 Method: `getAmount(count, filterId?, selectValue?)`

Returns up to `count` items. Optionally filter by ID and control selected columns.

#### Parameters:
- `count` (`number`)
- `filterId?` (`string|number|null`)
- `selectValue?` (`SelectQuery`) — Default: `"*"`

#### Returns:
- `Promise<FreeObj[]>`

---

### 📄 Method: `getAll(filterId?, selectValue?)`

Fetches all records in the table or filtered by a specific ID.

#### Parameters:
- `filterId?` (`string|number|null`)
- `selectValue?` (`SelectQuery`) — Default: `"*"`

#### Returns:
- `Promise<FreeObj[]>`

---

### 📚 Method: `execPagination(query, params, perPage, page, queryName?)`

Runs a paginated query and returns total items and total pages.

#### Parameters:
- `query` (`string`)
- `params` (`any[]`)
- `perPage` (`number`)
- `page` (`number`)
- `queryName?` (`string`) — Optional label for debugging.

#### Returns:
- `Promise<{ items: FreeObj[], totalPages: number, totalItems: number }>` — Paginated result set.

---

### 🧩 Method: `_parseWhere(pCache, group)`

Parses a flexible query condition group into a SQL WHERE clause.

#### Supports:
- Logical groups (`AND`, `OR`)
- Custom condition handlers (`this.#conditions`)
- Nested or flat filters
- Placeholders via `pCache`

#### Parameters:
- `pCache` (`Pcache`) — Placeholder manager: `{ index: number, values: any[] }`
- `group` (`QueryGroup`) — Group or single condition object.

#### Returns:
- `string` — SQL WHERE clause string (without `WHERE`)

#### Example:
```js
const p = { index: 1, values: [] };
const clause = this._parseWhere(p, {
  group: 'OR',
  conditions: [
    { column: 'status', value: 'active' },
    { column: 'type', value: 'admin', operator: '=' },
  ],
});
// clause: "(status = $1) OR (type = $2)"
// p.values: ['active', 'admin']
```

---

### 🔄 Method: `_insertJoin()`

Returns a default `LEFT JOIN` clause if configured in `#settings`.

#### Returns:
- `string` — SQL JOIN clause or empty string.

---

### 🔗 `#joinTypes` (private)

Internal object with predefined JOIN types:

- `inner`: `'INNER JOIN'`
- `left`: `'LEFT JOIN'`
- `right`: `'RIGHT JOIN'`
- `full`: `'FULL JOIN'`
- `cross`: `'CROSS JOIN'`
- `join`: `'JOIN'` (shorthand for inner)

---

### 🧩 Method: `_parseJoin(join)`

Parses JOIN configuration into one or more SQL JOIN clauses.

#### Parameters:
- `join` (`JoinObj | JoinObj[] | string | null`)

#### Returns:
- `string` — JOIN clauses string.

---

### 🔍 Method: `find(searchData)`

Finds the **first** matching result and returns its position, page, and optionally its data.

Query only: `_findQuery(searchData)`

#### Parameters:
- `searchData` (`object`)
  - `q`: QueryGroup or object condition
  - `tagCriteria`: Single or multiple tag filters
  - `tagCriteriaOps`: Logical ops between tag filters
  - `isFlatTags`: Use `_parseWhereFlat()` for tag criteria
  - `perPage`: Required, results per page
  - `select`: Columns to select (`'*'` by default, or `null` to skip data)
  - `order`: Custom `ORDER BY`
  - `join`: JOIN configs (string, object or array)

#### Returns:
- `Promise<FindResult|null>`

---

### 🔎 Method: `search(searchData)`

Performs a complete filtered query with optional **pagination**, **joins**, and **tags**.

Query only: `_searchQuery(searchData)`

#### Parameters:

* `searchData` (`object`)

  * `q`: QueryGroup or flat condition object
  * `tagsQ`: Tags filter (array or object)
  * `tagsOpsQ`: Logical ops between tags (`['AND', 'OR']`)
  * `isFlatTags`: Use `_parseWhereFlat()` for tag criteria
  * `select`: Select clause (`'*'`, array, object or `null`)
  * `perPage`: Items per page
  * `page`: Page number (default: 1)
  * `order`: Custom ORDER BY clause
  * `join`: JOINs configuration
  * `limit`: Max number of rows (ignored if `perPage` is used)

#### Returns:

* `Promise<FreeObj[] | PaginationResult>`

#### Example:

```js
await table.search({
  q: {
    group: 'AND',
    conditions: [
      { column: 'status', value: 'active' },
      {
        group: 'OR',
        conditions: [
          { column: 'type', value: 'admin' },
          { column: 'type', value: 'mod' }
        ]
      }
    ]
  },
  tagsQ: [{ column: 'tags', value: 'featured' }],
  select: '*',
  perPage: 15,
  page: 1,
  order: 'created_at DESC',
  join: [
    { type: 'left', table: 'profiles', compare: 't.profile_id = j1.id' },
    { type: 'left', table: 'roles', compare: 'j1.role_id = j2.id' }
  ]
});
```

