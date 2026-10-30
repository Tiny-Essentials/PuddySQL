# 📘 `PuddySqlTags` – Tag Expression Parser for SQL

`PuddySqlTags` is a modular utility designed to parse complex tag-based queries and convert them into structured SQL-friendly expressions. This makes it easy to support user-friendly search strings with support for AND/OR logic, wildcard parsing, symbolic operators, boosts, and more.

---

## 🏗️ Constructor

### `new PuddySqlTags(defaultColumn = 'tags')`

Initializes a new instance of the tag engine with a default SQL column.

| Parameter       | Type     | Description                                |
| --------------- | -------- | ------------------------------------------ |
| `defaultColumn` | `string` | Default column name to be used in queries. |

---

## 🔐 Private Internals

### `#tagInputs`

An internal mapping of symbolic prefixes to tag group definitions.
This enables flexible categorization, such as boosts (`^`) or fuzzy matches (`~`).

#### Default mappings:

```js
{
  '^': { list: 'boosts', valueKey: 'boost' },
  '~': { list: 'fuzzies', valueKey: 'fuzzy' }
}
```

---

## ➕ Tag Input API

### `addTagInput(key, list, valueKey)`

Adds a new tag input mapping.

| Parameter  | Type     | Description                             |
| ---------- | -------- | --------------------------------------- |
| `key`      | `string` | Symbolic key (e.g., `^`, `~`)           |
| `list`     | `string` | The tag list name to assign values to   |
| `valueKey` | `string` | The key name that maps to the tag value |

❌ Throws if `list` is `"include"` or `"column"`.

---

### `hasTagInput(key): boolean`

Checks if a tag input exists for a given symbol.

---

### `removeTagInput(key)`

Deletes a tag input mapping by symbol key.
❌ Throws if the key does not exist.

---

### `getTagInput(key): TagInput`

Gets a specific tag input mapping.
❌ Throws if not found.

---

### `getAllTagInput(): TagInput[]`

Returns all tag input mappings.

---

## 🔁 Repeat Settings

### `setCanRepeat(value: boolean)`

Defines whether duplicate tags are allowed.
Setting `true` means repetitions are allowed.
Internally sets `#noRepeat = !value`.

---

## 🌟 Wildcard Configuration

### `setWildcard(where: 'wildcardA' | 'wildcardB', value: string)`

Sets custom wildcard symbols.

| Wildcard    | Use Case         |
| ----------- | ---------------- |
| `wildcardA` | Match many (`*`) |
| `wildcardB` | Match one (`?`)  |

---

## 🧠 Special Queries API

Special queries represent colon-prefixed filters such as `score:>100`, which are handled separately from tag matching.

---

### `addSpecialQuery({ title, parser })`

Adds a new special query definition.

| Field    | Type                 | Description                            |
| -------- | -------------------- | -------------------------------------- |
| `title`  | `string`             | The identifier (e.g. `"score"`)        |
| `parser` | `(string) => string` | Optional function to process its value |

---

### `hasSpecialQuery(title): boolean`

Checks if a special query is registered by title.

---

### `removeSpecialQuery(title)`

Deletes a special query by title.
❌ Throws if not found.

---

### `getSpecialQuery(title): function|null`

Retrieves the parser function for a special query.
Returns `null` if no parser is defined.
❌ Throws if the title does not exist.

---

### `getAllSpecialQuery(): string[]`

Returns a list of all special query titles.

---

## ⚙️ Configuration Methods

### `setColumnName(value: string)`

Sets the default SQL column used for tag filters.

---

### `getColumnName(): string`

Gets the current default column name.

---

### `setParseLimit(value: number)`

Limits the number of tags parsed from the search string.

* Use `-1` to disable the limit.

---

### `getParseLimit(): number`

Returns the currently set tag parse limit.

---

### `setUseJsonEach(value: boolean)`

Enables or disables the use of `json_each()` in SQL.

This changes whether subqueries use JSON array iteration or direct joins.

---

### `setTableName(value: string)`

Sets the external table name name used in `EXISTS` subqueries, typically referencing `value`.

---

### `setJsonEach(value: string|null)`

Sets the SQL expression used for `json_each()` parsing, such as:

```sql
json_each(tags)
```

---

## 🧱 Query Generation

### 🔧 `setIsPgMode(value: boolean)`

Sets whether the engine should behave as if it's running in PostgreSQL mode, affecting how some SQL queries (like array or tag checks) are constructed.

📝 **Parameter**:

  * `value` (`boolean`) – Must be `true` or `false`.

---

### 🧪 `getIsPgMode(): boolean`

Retrieves whether the engine is currently in PostgreSQL mode.

📝 **Returns**:

  * `boolean` – `true` if running in PostgreSQL mode, `false` otherwise.

---

### `_parseWhere(group: TagCriteria, pCache: Pcache): string`

Builds a SQL `WHERE` clause from a tag group definition.

* Handles tag negation (`!tag`)
* Supports wildcard substitution (`*`, `?`)
* Uses `EXISTS` / `NOT EXISTS` for JSON arrays
* Uses `= ANY(column)` when `setIsPgMode(true)` is enabled
* Supports grouped OR conditions
* Modifies `pCache` in-place to fill parameters (`$1`, `$2`, ...)

📝 **Returns**: a full `WHERE` expression string like:

```sql
(EXISTS (...)) AND (NOT EXISTS (...))
```

---

### `_parseWhereFlat(group: TagCriteria, pCache: Pcache): string`

Builds an SQL `WHERE` clause for *flat* tag tables — where each row contains a single tag value.

* Does **not** use `EXISTS` or `json_each`
* Supports **negation** (`!tag`)
* Handles **wildcards** (`*`, `?`) when enabled
* Allows **OR groups** using nested arrays
* Updates `pCache` in-place with positional parameters (`$1`, `$2`, ...)

📝 **Returns**:
A complete SQL `WHERE` expression string like:

```sql
(tag = $1 AND (tag LIKE $2 OR tag != $3))
```

---

## 🧬 Internal Parsing Logic

### `#extractSpecialsFromChunks(chunks: Chunks): object`

Extracts custom tag inputs and special queries from parsed terms.

It does all of the following:

* Detects symbolic values (like `tag^2`)
* Detects colon queries (like `source:ponybooru`)
* Avoids repetition if `#noRepeat` is enabled
* Restructures the `chunks` array to remove consumed terms

📝 **Returns** an object like:

```js
{
  specials: [{ key: 'source', value: 'ponybooru' }],
  boosts: [{ term: 'applejack', boost: 2 }]
}
```

---

## 🧠 Full Expression Parser

### `parseString(input: string, strictMode?: boolean, strictConfig?: object): ParseStringResult`

Main parser function that accepts a raw string like:

```
"fluttershy", (solo OR duo), score:>50, applejack^2
```

And returns a structured output:

```js
{
  column: 'tags',
  include: ['fluttershy', ['solo', 'duo'], 'applejack'],
  specials: [{ key: 'score', value: '>50' }],
  boosts: [{ term: 'applejack', boost: 2 }]
}
```

✅ Features:

* Handles parentheses as OR groups
* Handles quotes
* Detects `AND` / `OR`
* Optional strict validation:

  * Balanced parentheses
  * Closed quotes
  * Input presence
  * Limit enforcement

🧩 **Strict Config Options**:

| Key          | Default | Description                            |
| ------------ | ------- | -------------------------------------- |
| `emptyInput` | `true`  | Error if input is empty after trimming |
| `parseLimit` | `true`  | Enforces tag parsing limit             |
| `openParens` | `true`  | Requires balanced parentheses          |
| `quoteChar`  | `true`  | Requires closed quotes                 |

---

## 🧼 Input Sanitization

### `safeParseString(input: string, strictMode?: boolean, strictConfig?: object): ParseStringResult`

🔒 **Safe wrapper** around `parseString()` that pre-processes flexible or symbolic user input into a more normalized format before parsing.

### 💡 What it does:

* Replaces:

  * `-tag` → `!tag`
  * `NOT tag` → `!tag`
  * `&&` → `AND`
  * `||` → `OR`
  * Commas (`,`) → `AND`
* Trims and formats the string for consistency

This is perfect for dealing with input from:

* Search boxes 🧠
* Textareas 📄
* Human-readable query builders 🧑‍💻

---

### ✅ Example

```js
safeParseString("applejack, -cookie, rarity || twilight");
```

Will be transformed into:

```js
parseString("applejack AND !cookie AND rarity OR twilight");
```

Which is then parsed as:

```js
{
  column: 'tags',
  include: ['applejack', '!cookie', 'rarity', 'twilight'],
  ...
}
```

---

## 💖 Special Thanks

Deep gratitude to the **Derpibooru** project for the inspiration, structure, and creativity  
that influenced this tool. A tiny heartfelt thank you to **Nighty**. :3
