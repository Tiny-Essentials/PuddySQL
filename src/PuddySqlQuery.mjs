import { pg } from './Modules.mjs';
import PuddySqlEngine from './PuddySqlEngine.mjs';
import PuddySqlTags from './PuddySqlTags.mjs';
import { isJsonObject } from './tiny-modules/basics/objChecker.mjs';

/**
 * Defines the schema structure used to create or modify SQL tables programmatically.
 *
 * Each entry in the array represents a single column definition as a 4-item tuple:
 *   [columnName, columnType, columnOptions, columnMeta]
 *
 * - `columnName` (`string`) – The name of the column (e.g., `"id"`, `"username"`).
 * - `columnType` (`string`) – The SQL data type (e.g., `"TEXT"`, `"INTEGER"`, `"BOOLEAN"`).
 * - `columnOptions` (`string`) – SQL options like `NOT NULL`, `PRIMARY KEY`, `DEFAULT`, etc.
 * - `columnMeta` (`any`) – Arbitrary metadata related to the column (e.g., for UI, descriptions, tags).
 *
 * @typedef {Array<[string, string, string, string]>} SqlTableConfig
 */

/**
 * Represents the result of a paginated SQL query to locate the exact position of a specific item.
 *
 * @typedef {Object} FindResult
 * @property {number} page - The current page number where the item is located (starting from 1).
 * @property {number} pages - The total number of pages available in the dataset.
 * @property {number} total - The total number of items in the dataset.
 * @property {number} position - The exact index position of the item in the entire dataset (starting from 0).
 * @property {FreeObj} [item] - The actual item found, if included in the result.
 */

/**
 * Tag group definition used to build dynamic SQL clauses for tag filtering.
 *
 * @typedef {Object} TagCriteria - Tag group definition to build the clause from.
 * @property {string} [group.column] - SQL column name for tag data (defaults to `this.getColumnName()`).
 * @property {string} [group.tableName] - Optional table name used (defaults to `this.defaultTableName`).
 * @property {boolean} [group.allowWildcards=false] - Whether wildcards are allowed in matching.
 * @property {Array<string|string[]>} [group.include=[]] - Tag values or grouped OR conditions to include.
 */

/**
 * Represents the result of a paginated query.
 *
 * @typedef {Object} PaginationResult
 * @property {any[]} items - Array of items returned for the current page.
 * @property {number} totalPages - Total number of available pages based on the query and per-page limit.
 * @property {number} totalItems - Total number of items matching the query without pagination.
 */

/**
 * Represents a flexible select query input, allowing for different forms.
 *
 * @typedef {(
 *   string |
 *   string[] |
 *   {
 *     aliases?: Record<string, string>; // Mapping of display names to real column names.
 *     values?: string[];                // List of column names to select.
 *     boost?: {                         // Boost configuration for weighted ranking.
 *       alias?: string;                 // The alias to associate with the boost configuration.
 *       value?: BoostValue[];           // List of boost rules to apply.
 *     };
 *   } |
 *   null
 * )} SelectQuery
 */

/**
 * Parameter cache used to build the WHERE clause.
 *
 * @typedef {Object} Pcache - Parameter cache used to build the WHERE clause.
 * @property {number} [pCache.index=1] - Starting parameter index for SQL placeholders (e.g., `$1`, `$2`...).
 * @property {any[]} [pCache.values=[]] - Collected values for SQL query binding.
 */

/**
 * Represents a free-form object with unknown values and arbitrary keys.
 *
 * @typedef {Record<string | number | symbol, any>} FreeObj
 *
 * An object type where keys can be strings, numbers, or symbols, and values can be any unknown type.
 * Useful for generic data containers where the structure is not strictly defined.
 */

/**
 * Represents conditions used in a SQL WHERE clause.
 *
 * @typedef {Object} WhereConditions
 * @property {'OR'|'AND'|'or'|'and'} [group] - Logical operator to combine conditions (`AND`/`OR`). Case-insensitive.
 *                                             Only used when `conditions` is provided.
 * @property {QueryGroup[]} [conditions] - Array of grouped `WhereConditions` or `QueryGroup` entries.
 *                                         Used for nesting logical clauses.
 *
 * @property {string|null|undefined} [funcName] - Optional function name applied to the column (e.g., UPPER, LOWER).
 * @property {string|null|undefined} [operator] - Comparison operator (e.g., '=', 'LIKE', 'IN').
 * @property {string|null|undefined} [value] - Value to compare against.
 * @property {string|null|undefined} [valType] - Custom function for value transformation (e.g., for SOUNDEX).
 * @property {'left'|'right'|null|undefined} [lPos] - Logical position indicator (e.g., 'left', 'right') for chaining.
 * @property {string|null|undefined} [newOp] - Replacement operator, used to override the main one.
 * @property {string|null|undefined} [column] - Name of the column to apply the condition on.
 */

/**
 * Represents a flexible condition group used in dynamic SQL WHERE clause generation.
 *
 * A `QueryGroup` can take two forms:
 *
 * 1. **Single condition object** — represents a single `WhereConditions` instance:
 *    ```js
 *    {
 *      column: 'name',
 *      operator: '=',
 *      value: 'pudding'
 *    }
 *    ```
 *
 * 2. **Named group of conditions** — an object mapping condition names or keys
 *    to individual `WhereConditions` objects:
 *    ```js
 *    {
 *      searchByName: {
 *        column: 'name',
 *        operator: 'ILIKE',
 *        value: '%fluttershy%'
 *      },
 *      searchByType: {
 *        column: 'type',
 *        operator: '=',
 *        value: 'pegasus'
 *      }
 *    }
 *    ```
 *
 * This structure allows dynamic grouping of multiple WHERE conditions
 * (useful for advanced filters, tag clauses, or scoped searches).
 *
 * @typedef {WhereConditions | Record<string, WhereConditions>} QueryGroup
 */

/**
 * Represents a boosting rule for weighted query ranking.
 *
 * @typedef {Object} BoostValue
 * @property {string[]} [columns] - List of columns to apply the boost on.
 * @property {''|'LIKE'|'ILIKE'} [operator=''] - Operator used in the condition (e.g., '=', 'LIKE').
 * @property {string|string[]} [value] - Value to match in the condition.
 * @property {boolean} [array=false] - When true, performs matching using `json_each()` for JSON/ARRAY columns instead of text comparison.
 * @property {number} [weight=1] - Weight factor to boost results matching the condition.
 */

/**
 * Each join object must contain:
 * - `table`: The name of the table to join.
 * - `compare`: The ON clause condition.
 * - `type` (optional): One of the supported JOIN types (e.g., 'left', 'inner'). Defaults to 'left'.
 *
 * @typedef {{ table: string; compare: string; type?: string; }} JoinObj
 */

/**
 * @typedef {Object} TableSettings
 * @property {string} [name]
 * @property {SelectQuery} [select='*'] - SELECT clause configuration. Can be simplified; complex expressions are auto-formatted.
 * @property {string|null} [join=null] - Optional JOIN table name.
 * @property {string|null} [joinCompare='t.key = j.key'] - Condition used to match JOIN tables.
 * @property {string|null} [order=null] - Optional ORDER BY clause.
 * @property {string} [id='key'] - Primary key column name.
 * @property {string|null} [subId=null] - Optional secondary key column name.
 */

/**
 * Configuration settings for a SQL entity, defining how it should be queried and joined.
 *
 * @typedef {Object} Settings
 * @property {string} select - The default columns to select in a query (e.g., `"*"`, or `"id, name"`).
 * @property {string} name - The name of the main table or view.
 * @property {string} id - The primary key column name.
 * @property {string|null} joinCompare - Optional column used to match in JOIN conditions (e.g., `"main.id = sub.fk_id"`).
 * @property {string|null} order - Default column used to order results (e.g., `"created_at DESC"`).
 * @property {string|null} subId - Secondary identifier column name (for composite keys or scoped tables).
 * @property {string|null} join - SQL JOIN clause to apply (e.g., `"LEFT JOIN profiles ON users.id = profiles.user_id"`).
 */

/**
 * A function that takes a WhereConditions object and returns a modified WhereConditions object.
 * Typically used to append or transform SQL WHERE clauses.
 *
 * @typedef {(conditions: WhereConditions) => WhereConditions} WhereConditionsFunc
 */

/**
 * A map of condition identifiers to their associated transformation functions.
 * Each key represents a named SQL condition function.
 *
 * @typedef {Record<string, WhereConditionsFunc>} SqlConditions
 */

/**
 * TinySQLQuery is a queries operating system developed to operate in a specific table.
 */
class PuddySqlQuery {
  /** @type {SqlConditions} */
  #conditions = {};

  /** @type {Record<string, function(string) : string>} */
  #customValFunc = {};

  /** @type {PuddySqlEngine|null} */
  #db = null;

  /**
   * @type {Settings}
   */
  #settings = {
    joinCompare: '',
    select: '',
    name: '',
    id: '',
    order: null,
    subId: null,
    join: null,
  };

  /**
   * @type {Record<string, {
   *  type: string|null,
   *  options: string|null,
   * }>}
   */
  #table = {};

  /** @type {Record<string, PuddySqlTags>} */
  #tagColumns = {};

  /**
   * Safely retrieves the internal database instance.
   *
   * This method ensures that the current internal `#db` is a valid instance of `PuddySqlEngine`.
   * If the internal value is invalid or was not properly initialized, an error is thrown.
   *
   * @returns {PuddySqlEngine} The internal database instance.
   * @throws {Error} If the internal database is not a valid `PuddySqlEngine`.
   */
  getDb() {
    // @ts-ignore
    if (this.#db === null || !(this.#db instanceof PuddySqlEngine)) {
      throw new Error(
        'Database instance is invalid or uninitialized. Expected an instance of PuddySqlEngine.',
      );
    }
    return this.#db;
  }

  constructor() {
    // Predefined condition operator mappings used in searches
    this.addCondition('LIKE', (condition) => ({
      operator: 'LIKE',
      value:
        `${typeof condition.lPos !== 'string' || condition.lPos === 'left' ? '%' : ''}` +
        `${condition.value}` +
        `${typeof condition.lPos !== 'string' || condition.lPos === 'right' ? '%' : ''}`,
    }));

    this.addCondition('NOT', '!=');
    this.addCondition('=', '=');
    this.addCondition('!=', '!=');
    this.addCondition('>=', '>=');
    this.addCondition('<=', '<=');
    this.addCondition('>', '>');
    this.addCondition('<', '<');

    // Soundex with custom value handler
    this.addConditionV2('SOUNDEX', true); // Performs phonetic comparison based on how words sound. Example: SOUNDEX(name) = SOUNDEX('rainbow')

    // Case conversion
    this.addConditionV2('LOWER'); // Converts all characters in the column to lowercase. Example: LOWER(username) = 'fluttershy'
    this.addConditionV2('UPPER'); // Converts all characters in the column to uppercase. Example: UPPER(username) = 'FLUTTERSHY'

    // Trimming whitespace
    this.addConditionV2('TRIM'); // Removes leading and trailing whitespace. Example: TRIM(title) = 'pony party'
    this.addConditionV2('LTRIM'); // Removes leading whitespace only. Example: LTRIM(title) = 'pony party'
    this.addConditionV2('RTRIM'); // Removes trailing whitespace only. Example: RTRIM(title) = 'pony party'

    // String and value length
    this.addConditionV2('LENGTH'); // Returns the number of characters in the column. Example: LENGTH(comment) > 100

    // Mathematical operations
    this.addConditionV2('ABS'); // Compares the absolute value of a column. Example: ABS(score) = 10
    this.addConditionV2('ROUND'); // Rounds the numeric value of the column. Example: ROUND(rating) = 4
    this.addConditionV2('CEIL', false, '>='); // Rounds the value up before comparison. Example: CEIL(price) >= 50
    this.addConditionV2('FLOOR', false, '<='); // Rounds the value down before comparison. Example: FLOOR(price) <= 49

    // Null and fallback handling
    this.addConditionV2('COALESCE'); // Uses a fallback value if the column is NULL. Example: COALESCE(nickname) = 'anonymous'

    // String formatting
    this.addConditionV2('HEX'); // Converts value to hexadecimal string. Example: HEX(id) = '1A3F'
    this.addConditionV2('QUOTE'); // Returns the string quoted. Example: QUOTE(title) = "'hello world'"

    // Character and Unicode
    this.addConditionV2('UNICODE'); // Gets the Unicode of the first character. Example: UNICODE(letter) = 9731
    this.addConditionV2('CHAR'); // Converts a code point to its character. Example: CHAR(letter_code) = 'A'

    // Type inspection
    this.addConditionV2('TYPEOF'); // Returns the data type of the value. Example: TYPEOF(data_field) = 'text'

    // Date and time extraction
    this.addConditionV2('DATE'); // Extracts the date part. Example: DATE(timestamp) = '2025-04-15'
    this.addConditionV2('TIME'); // Extracts the time part. Example: TIME(timestamp) = '15:30:00'
    this.addConditionV2('DATETIME'); // Converts to full datetime. Example: DATETIME(created_at) = '2025-04-15 14:20:00'
    this.addConditionV2('JULIANDAY'); // Converts to Julian day number. Example: JULIANDAY(date_column) = 2460085.5
  }

  /**
   * Checks whether a specific SQL condition function is registered.
   *
   * @param {string} key - The condition identifier to look up.
   * @returns {boolean} - Returns true if the condition exists, otherwise false.
   */
  hasCondition(key) {
    if (!this.#conditions[key]) return false;
    return true;
  }

  /**
   * Retrieves a registered SQL condition function by its identifier.
   *
   * @param {string} key - The condition identifier to retrieve.
   * @returns {WhereConditionsFunc} - The associated condition function.
   * @throws {Error} If the condition does not exist.
   */
  getCondition(key) {
    if (!this.hasCondition(key)) throw new Error('Condition not found: ' + key);
    return this.#conditions[key];
  }

  /**
   * Returns a shallow copy of all registered SQL condition functions.
   *
   * @returns {SqlConditions} - An object containing all condition functions mapped by key.
   */
  getConditions() {
    return { ...this.#conditions };
  }

  /**
   * Registers a new condition under a unique key to be used in query generation.
   *
   * The `conditionHandler` determines how the condition will behave. It can be:
   * - A **string**, representing a SQL operator (e.g., '=', '!=', 'LIKE');
   * - An **object**, which must include an `operator` key (e.g., { operator: '>=' });
   * - A **function**, which receives a `condition` object and returns a full condition definition.
   *
   * If a `valueHandler` is provided, it must be a function that handles value transformation,
   * and will be stored under the same key in the internal value function map.
   *
   * This method does not allow overwriting an existing key in either condition or value handlers.
   *
   * @param {string} key - Unique identifier for the new condition type.
   * @param {string|WhereConditions|WhereConditionsFunc} conditionHandler - Defines the logic or operator of the condition.
   * @param {(function(string): string)|null} [valueHandler=null] - Optional custom function for value transformation (e.g., for SOUNDEX).
   *
   * @throws {Error} If the key is not a non-empty string.
   * @throws {Error} If the key already exists in either conditions or value handlers.
   * @throws {Error} If conditionHandler is not a string, object with `operator`, or function.
   * @throws {Error} If valueHandler is provided but is not a function.
   */
  addCondition(key, conditionHandler, valueHandler = null) {
    if (typeof key !== 'string' || key.trim() === '') {
      throw new TypeError(`Condition key must be a non-empty string.`);
    }
    if (this.#conditions[key] || this.#customValFunc[key]) {
      throw new Error(`Condition key "${key}" already exists.`);
    }

    const isFunc = typeof conditionHandler === 'function';
    const isStr = typeof conditionHandler === 'string';
    const isObj = isJsonObject(conditionHandler);

    if (!isFunc && !isStr && !isObj) {
      throw new TypeError(
        `Condition handler must be a string (operator), an object with an "operator", or a function.`,
      );
    }

    if (isObj) {
      if (typeof conditionHandler.operator !== 'string' || !conditionHandler.operator.trim()) {
        throw new TypeError(
          `When using an object as condition handler, it must contain a non-empty string "operator" field.`,
        );
      }
    }

    if (valueHandler !== null && typeof valueHandler !== 'function')
      throw new TypeError(`Custom value handler must be a function if provided.`);

    // Add condition
    this.#conditions[key] = isStr
      ? () => ({ operator: conditionHandler })
      : isObj
        ? () => ({ ...conditionHandler }) // Clone the object
        : conditionHandler; // function

    // Add value handler if provided
    if (valueHandler) this.#customValFunc[key] = valueHandler;
  }

  /**
   * Registers a SQL function-based condition with optional operator and value transformation.
   *
   * This helper wraps a SQL column in a function (e.g., `LOWER(column)`) and optionally
   * transforms the parameter using the same function (e.g., `LOWER($1)`), depending on config.
   *
   * It integrates with the dynamic condition system that uses:
   *   - `#conditions[name]` for SQL structure generation
   *   - `#customValFunc[valType]` for optional value transformations
   *
   * @param {string} funcName - SQL function name to wrap around the column (e.g., `LOWER`, `SOUNDEX`).
   * @param {boolean} [editParamByDefault=false] - If true, also applies the SQL function to the parameter by default.
   * @param {string} [operator='='] - Default SQL comparison operator (e.g., `=`, `!=`, `>`, `<`).
   *
   * -----------------------------------------------------
   *
   * Runtime Behavior:
   * - Uses `group.newOp` (if provided) to override the default operator.
   * - Uses `group.funcName` (if string) to override the default function name used in `valType`.
   * - If `funcName !== null` and `editParamByDefault === true`, the function will also apply to the param.
   * - The final SQL looks like: FUNC(column) OP FUNC($n), if both sides use the same function.
   *
   *
   * The `group` object passed at runtime may include:
   * @param {Object} group
   * @param {string} group.column - The column name to apply the function on.
   * @param {string} [group.newOp] - Optional override for the comparison operator.
   * @param {string|null} [group.funcName] - Optional override for the SQL function name
   *                                             (affects both SQL column and valType used in `#customValFunc`).
   *
   * @throws {TypeError} If `funcName` is not a non-empty string.
   * @throws {TypeError} If `editParamByDefault` is provided and is not a boolean.
   * @throws {TypeError} If `operator` is not a non-empty string.
   *
   * --------------------------------------------------------------------------------
   * How it's used in the system:
   *
   * ```js
   * const result = this.#conditions[group.operator](group);
   * const param = typeof this.#customValFunc[result.valType] === 'function'
   *   ? this.#customValFunc[result.valType](`$1`)
   *   : `$1`;
   * const sql = `${result.column} ${result.operator} ${param}`;
   * ```
   *
   * -----------------------------------------------------
   * @example
   * // Registers a ROUND() comparison with "!="
   * addConditionV2('ROUND', false, '!=');
   *
   * -----------------------------------------------------
   * @example
   * // Registers LOWER() with editParamByDefault
   * addConditionV2('LOWER', true);
   *
   * // Parses as: LOWER(username) = LOWER($1)
   * parse({ column: 'username', value: 'fluttershy', operator: 'LOWER' });
   *
   *  -----------------------------------------------------
   * @example
   * // Registers UPPER() = ? without editParamByDefault
   * addConditionV2('UPPER');
   *
   * // Parses as: UPPER(username) = $1
   * parse({ column: 'username', value: 'rarity', operator: 'UPPER' });
   *
   *  -----------------------------------------------------
   * @example
   * // Can be overridden at runtime:
   * addConditionV2('CEIL', true);
   *
   * parse({
   *  column: 'price',
   *  value: 3,
   *  newOp: '>',
   *  operator: 'CEIL',
   *  funcName: null
   * });
   *
   * // Result: CEIL(price) > 3
   */
  addConditionV2 = (funcName, editParamByDefault = false, operator = '=') => {
    if (typeof funcName !== 'string' || funcName.trim() === '')
      throw new TypeError(`funcName must be a non-empty string. Received: ${funcName}`);
    if (typeof editParamByDefault !== 'boolean')
      throw new TypeError(`editParamByDefault must be a boolean. Received: ${editParamByDefault}`);
    if (typeof operator !== 'string' || operator.trim() === '')
      throw new TypeError(`operator must be a non-empty string. Received: ${operator}`);

    return this.addCondition(
      funcName,
      (condition) => ({
        operator: typeof condition.newOp === 'string' ? condition.newOp : operator,
        valType:
          typeof condition.funcName === 'string'
            ? condition.funcName
            : editParamByDefault && condition.funcName !== null
              ? funcName
              : null,
        column: `${funcName}(${condition.column})`,
      }),
      (param) => `${funcName}(${param})`,
    );
  };

  /**
   * Generates a SELECT clause based on the input, supporting SQL expressions, aliases,
   * and boosts using CASE statements.
   *
   * This method supports the following input formats:
   *
   * - `null` or `undefined`: returns '*'
   * - `string`: returns the parsed column/expression (with optional aliasing if `AS` is present)
   * - `string[]`: returns a comma-separated list of parsed columns
   * - `object`: supports structured input with:
   *   - `aliases`: key-value pairs of column names and aliases
   *   - `values`: array of column names or expressions
   *   - `boost`: object describing a weighted relevance score using CASE statements
   *     - Must include `alias` (string) and `value` (array of boost rules)
   *     - Each boost rule supports:
   *       - `columns` (string|string[]): target columns to apply the condition on (optional)
   *       - `value` (string|array): value(s) to compare, or a raw SQL condition if `columns` is omitted
   *       - `operator` (string): SQL comparison operator (default: 'LIKE', supports 'IN', '=', etc.)
   *       - `weight` (number): numeric weight applied when condition matches (default: 1)
   *     - If `columns` is omitted, the `value` is treated as a raw SQL condition inserted directly into the CASE.
   *
   * Escaping of all values is handled by `pg.escapeLiteral()` for SQL safety (PostgreSQL).
   *
   * @param {SelectQuery} [input = '*'] - Select clause definition.
   * @returns {string} - A valid SQL SELECT clause string.
   *
   * @throws {TypeError} If the input is of an invalid type.
   * @throws {Error} If `boost.alias` is missing or not a string.
   * @throws {Error} If `boost.value` is present but not an array.
   *
   * @example
   * this.selectGenerator();
   * // returns '*'
   *
   * this.selectGenerator('COUNT(*) AS total');
   * // returns 'COUNT(*) AS total'
   *
   * this.selectGenerator(['id', 'username']);
   * // returns 'id, username'
   *
   * this.selectGenerator({
   *   aliases: {
   *     id: 'image_id',
   *     uploader: 'user_name'
   *   },
   *   values: ['created_at', 'score']
   * });
   * // returns 'id AS image_id, uploader AS user_name, created_at, score'
   *
   * this.selectGenerator({
   *   aliases: {
   *     id: 'image_id',
   *     uploader: 'user_name'
   *   },
   *   values: ['created_at'],
   *   boost: {
   *     alias: 'relevance',
   *     value: [
   *       {
   *         columns: ['tags', 'description'],
   *         value: 'fluttershy',
   *         weight: 2
   *       },
   *       {
   *         columns: 'tags',
   *         value: 'pinkie pie',
   *         operator: 'LIKE',
   *         weight: 1.5
   *       },
   *       {
   *         columns: 'tags',
   *         value: 'oc',
   *         weight: -1
   *       },
   *       {
   *         value: "score > 100 AND views < 1000",
   *         weight: 5
   *       }
   *     ]
   *   }
   * });
   * // returns something like:
   * // CASE
   * //   WHEN tags LIKE '%fluttershy%' OR description LIKE '%fluttershy%' THEN 2
   * //   WHEN tags LIKE '%pinkie pie%' THEN 1.5
   * //   WHEN tags LIKE '%oc%' THEN -1
   * //   WHEN score > 100 AND views < 1000 THEN 5
   * //   ELSE 0
   * // END AS relevance, id AS image_id, uploader AS user_name, created_at
   */
  selectGenerator(input = '*') {
    // If input is a string, treat it as a custom SQL expression
    if (typeof input === 'string') return this.parseColumn(input);

    /**
     * Boost parser helper
     *
     * @param {BoostValue[]} boostArray
     * @param {string} alias
     * @returns {string}
     */
    const parseAdvancedBoosts = (boostArray, alias) => {
      if (!Array.isArray(boostArray))
        throw new TypeError(`Boost 'value' must be an array. Received: ${typeof boostArray}`);
      if (typeof alias !== 'string')
        throw new TypeError(`Boost 'alias' must be an string. Received: ${typeof alias}`);
      const cases = [];

      // Boost
      for (const boost of boostArray) {
        // Validator
        const { columns, operator = '', value, weight = 1, array = false } = boost;
        if (typeof operator !== 'string')
          throw new TypeError(`operator requires an string value. Got: ${typeof operator}`);
        const opValue = operator.toUpperCase();
        if (typeof weight !== 'number' || Number.isNaN(weight))
          throw new TypeError(`Boost 'weight' must be a valid number. Got: ${weight}`);
        if (['LIKE', 'ILIKE', ''].indexOf(opValue) < 0)
          throw new TypeError(
            `Invalid operator '${opValue}'. Only 'LIKE', 'ILIKE', or empty string '' are allowed.`,
          );

        // No columns mode
        if (!columns) {
          if (typeof value !== 'string')
            throw new TypeError(
              `Boost with no columns must provide a raw SQL string condition. Got: ${typeof value}`,
            );

          // No columns: treat value as raw condition
          cases.push(`WHEN ${value} THEN ${weight}`);
          continue;
        }

        // Check columns
        if (!Array.isArray(columns) || columns.some((col) => typeof col !== 'string'))
          throw new TypeError(
            `Boost 'columns' must be a string or array of strings. Got: ${columns}`,
          );

        // JSON/ARRAY Mode
        if (array === true) {
          if (Array.isArray(value)) {
            const conditions = columns.map((col) =>
              `
        EXISTS (
          SELECT 1 FROM json_each(${col})
          WHERE json_each.value IN (${value.map((v) => pg.escapeLiteral(v)).join(', ')})
        )
      `.trim(),
            );
            cases.push(`WHEN ${conditions.join(' OR ')} THEN ${weight}`);
          } else if (typeof value === 'string') {
            const safeVal = pg.escapeLiteral(value);
            const conditions = columns.map((col) =>
              `
        EXISTS (
          SELECT 1 FROM json_each(${col})
          WHERE json_each.value = ${safeVal}
        )
      `.trim(),
            );
            cases.push(`WHEN ${conditions.join(' OR ')} THEN ${weight}`);
          } else {
            throw new TypeError(
              `'array' mode requires string or array value. Got: ${typeof value}`,
            );
          }
          continue;
        }

        // IN Mode
        if (opValue === 'IN') {
          if (!Array.isArray(value))
            throw new TypeError(
              `'${opValue}' operator requires an array value. Got: ${typeof value}`,
            );

          const conditions = columns.map((col) => {
            const inList = value.map((v) => pg.escapeLiteral(v)).join(', ');
            return `${col} IN (${inList})`;
          });
          cases.push(`WHEN ${conditions.join(' OR ')} THEN ${weight}`);
          continue;
        }

        // Other modes (LIKE, =, etc.)
        if (typeof value !== 'string')
          throw new TypeError(
            `'${opValue}' operator requires a string value. Got: ${typeof value}`,
          );

        const safeVal = pg.escapeLiteral(
          ['LIKE', 'ILIKE'].includes(opValue) ? `%${value}%` : value,
        );
        const conditions = columns.map((col) => `${col} ${operator} ${safeVal}`);
        cases.push(`WHEN ${conditions.join(' OR ')} THEN ${weight}`);
      }

      return `CASE ${cases.join(' ')} ELSE 0 END AS ${alias}`;
    };

    // If input is an array, join all columns
    if (Array.isArray(input)) {
      return (
        input
          .map((col) => this.parseColumn(col))
          .filter(Boolean)
          .join(', ') || '*'
      );
    }

    // If input is an object, handle key-value pairs for aliasing (with boosts support)
    else if (isJsonObject(input)) {
      /** @type {string[]} */
      let result = [];

      // Processing aliases
      if (input.aliases) {
        if (!isJsonObject(input.aliases))
          throw new TypeError(`'aliases' must be an object. Got: ${typeof input.aliases}`);
        result = result.concat(
          Object.entries(input.aliases).map(([col, alias]) => this.parseColumn(col, alias)),
        );
      }

      // If input is an array, join all columns
      if (input.values) {
        if (!Array.isArray(input.values))
          throw new TypeError(`'values' must be an array. Got: ${typeof input.values}`);
        result.push(...input.values.map((col) => this.parseColumn(col)));
      }

      // Processing boosts
      if (input.boost) {
        if (!isJsonObject(input.boost))
          throw new TypeError(`'boost' must be an object. Got: ${typeof input.boost}`);

        if (typeof input.boost.alias !== 'string')
          throw new TypeError('Missing or invalid boost.alias in selectGenerator');
        if (input.boost.value)
          result.push(parseAdvancedBoosts(input.boost.value, input.boost.alias));
      }

      // Complete
      if (result.length > 0) return result.join(', ');
      else
        throw new TypeError(
          `Invalid input object keys for selectGenerator. Expected non-empty string.`,
        );
    }

    // Nothing
    else
      throw new TypeError(
        `Invalid input type for selectGenerator. Expected string, array, or object but received: ${typeof input}`,
      );
  }

  /**
   * Helper function to parse individual columns or SQL expressions.
   * Supports aliasing and complex expressions.
   *
   * @param {string} column - Column name or SQL expression.
   * @param {string} [alias] - Alias for the column (optional).
   * @returns {string} - A valid SQL expression for SELECT clause.
   */
  parseColumn(column, alias) {
    if (typeof column !== 'string')
      throw new TypeError(`column key must be string. Got: ${column}.`);
    if (typeof alias !== 'undefined' && typeof alias !== 'string')
      throw new TypeError(`Alias key must be string. Got: ${alias}.`);

    // If column contains an alias
    if (alias) {
      return `${column} AS ${alias}`;
    }

    return column;
  }

  // Helpers for JSON operations within SQL queries (SQLite-compatible)

  /**
   * @param {any} value
   * @returns {string}
   */
  #sqlOpStringVal = (value) => {
    if (typeof value !== 'string')
      throw new TypeError(`SQL Op value must be string. Got: ${typeof value}.`);
    return value;
  };

  // Example: WHERE json_extract(data, '$.name') = 'Rainbow Queen'
  /**
   * Extracts the value of a key from a JSON object using SQLite's json_extract function.
   * @param {string} where - The JSON column to extract from.
   * @param {string} name - The key or path to extract (dot notation).
   * @returns {string} SQL snippet to extract a value from JSON.
   */
  getJsonExtract = (where = '', name = '') =>
    `json_extract(${this.#sqlOpStringVal(where)}, '$.${this.#sqlOpStringVal(name)}')`;

  /**
   * Expands each element in a JSON array or each property in a JSON object into separate rows.
   * Intended for use in the FROM clause.
   * @param {string} source - JSON column or expression to expand.
   * @returns {string} SQL snippet calling json_each.
   */
  getJsonEach = (source = '') => `json_each(${this.#sqlOpStringVal(source)})`;

  // Example: FROM json_each(json_extract(data, '$.tags'))
  /**
   * Unrolls a JSON array from a specific key inside a JSON column using json_each.
   * Ideal for iterating over array elements in a FROM clause.
   * @param {string} where - The JSON column containing the array.
   * @param {string} name - The key of the JSON array.
   * @returns {string} SQL snippet to extract and expand a JSON array.
   */
  getArrayExtract = (where = '', name = '') => this.getJsonEach(this.getJsonExtract(where, name));

  // Example: WHERE CAST(json_extract(data, '$.level') AS INTEGER) > 10
  /**
   * Extracts a key from a JSON object and casts it to a given SQLite type (INTEGER, TEXT, REAL, etc.).
   * @param {string} where - The JSON column to extract from.
   * @param {string} name - The key or path to extract.
   * @param {string} type - The type to cast to (e.g., 'INTEGER', 'TEXT', 'REAL').
   * @returns {string} SQL snippet with cast applied.
   */
  getJsonCast = (where = '', name = '', type = 'NULL') =>
    `CAST(${this.getJsonExtract(where, name)} AS ${this.#sqlOpStringVal(type).toUpperCase()})`;

  /**
   * Updates the table by adding, removing, modifying or renaming columns.
   * @param {SqlTableConfig} changes - An array of changes to be made to the table.
   * Each change is defined by an array, where:
   *   - To add a column: ['ADD', 'columnName', 'columnType', 'columnOptions']
   *   - To remove a column: ['REMOVE', 'columnName']
   *   - To modify a column: ['MODIFY', 'columnName', 'newColumnType', 'newOptions']
   *   - To rename a column: ['RENAME', 'oldColumnName', 'newColumnName']
   * @returns {Promise<void>}
   *
   * @throws {TypeError} If `changes` is not an array of arrays.
   * @throws {Error} If any change has missing or invalid parameters.
   */
  async updateTable(changes) {
    const db = this.getDb();

    if (!Array.isArray(changes))
      throw new TypeError(`Expected 'changes' to be an array of arrays. Got: ${typeof changes}`);

    const tableName = this.#settings?.name;
    if (!tableName) throw new TypeError('Missing table name in settings');

    for (const change of changes) {
      const [action, ...args] = change;
      if (!Array.isArray(change))
        throw new TypeError(
          `Expected 'change value' to be an array of arrays. Got: ${typeof change}`,
        );
      if (typeof action !== 'string')
        throw new TypeError(`Action type must be a string. Got: ${typeof action}`);

      switch (action.toUpperCase()) {
        case 'ADD': {
          const [colName, colType, colOptions = ''] = args;
          if (typeof colName !== 'string' || typeof colType !== 'string')
            throw new Error(`Invalid parameters for ADD: ${JSON.stringify(args)}`);

          const query = `ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType} ${colOptions}`;
          try {
            await db.run(query, undefined, 'updateTable - ADD');
          } catch (err) {
            console.error('[sql] [updateTable - ADD] Error adding column:', err);
          }
          break;
        }

        case 'REMOVE': {
          const [colName] = args;
          if (typeof colName !== 'string')
            throw new Error(`Invalid parameters for REMOVE: ${JSON.stringify(args)}`);

          const query = `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${colName}`;
          try {
            await db.run(query, undefined, 'updateTable - REMOVE');
          } catch (err) {
            console.error('[sql] [updateTable - REMOVE] Error removing column:', err);
          }
          break;
        }

        case 'MODIFY': {
          const [colName, newType, newOptions] = args;
          if (
            typeof colName !== 'string' ||
            typeof newType !== 'string' ||
            (typeof newOptions !== 'undefined' && typeof newOptions !== 'string')
          )
            throw new Error(`Invalid parameters for MODIFY: ${JSON.stringify(args)}`);

          const query = `ALTER TABLE ${tableName} ALTER COLUMN ${colName} TYPE ${newType}${
            newOptions ? `, ALTER COLUMN ${colName} SET ${newOptions}` : ''
          }`;
          try {
            await db.run(query, undefined, 'updateTable - MODIFY');
          } catch (err) {
            console.error('[sql] [updateTable - MODIFY] Error modifying column:', err);
          }
          break;
        }

        case 'RENAME': {
          const [oldName, newName] = args;
          if (typeof oldName !== 'string' || typeof newName !== 'string')
            throw new Error(`Invalid parameters for RENAME: ${JSON.stringify(args)}`);

          const query = `ALTER TABLE ${tableName} RENAME COLUMN ${oldName} TO ${newName}`;
          try {
            await db.run(query, undefined, 'updateTable - RENAME');
          } catch (err) {
            console.error('[sql] [updateTable - RENAME] Error renaming column:', err);
          }
          break;
        }

        default:
          console.warn(`[sql] [updateTable] Unknown updateTable action: ${action}`);
      }
    }
  }

  /**
   * Drops the current table if it exists.
   *
   * This method executes a `DROP TABLE` query using the table name defined in `this.#settings.name`.
   * It's useful for resetting or cleaning up the database schema dynamically.
   * If the query fails due to connection issues (like `SQLITE_CANTOPEN` or `ECONNREFUSED`),
   * it rejects with the error; otherwise, it resolves with `false` to indicate failure.
   * On success, it resolves with `true`.
   *
   * @returns {Promise<boolean>} Resolves with `true` if the table was dropped, or `false` if there was an issue (other than connection errors).
   * @throws {Error} If there is an issue with the database or settings, or if the table can't be dropped.
   */
  async dropTable() {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const query = `DROP TABLE ${this.#settings.name};`;
      db.run(query, undefined, 'dropTable')
        .then(() => resolve(true))
        .catch((err) => {
          if (db.isConnectionError(err))
            reject(err); // Rejects on connection-related errors
          else resolve(false); // Resolves with false on other errors
        });
    });
  }

  /**
   * Creates a table in the database based on provided column definitions.
   * Also stores the column structure in this.#table as an object keyed by column name.
   * If a column type is "TAGS", it will be replaced with "JSON" for SQL purposes,
   * and registered in #tagColumns using a PuddySqlTags instance,
   * but the original "TAGS" value will be preserved in this.#table.
   * @param {SqlTableConfig} columns - An array of column definitions.
   * Each column is defined by an array containing the column name, type, and optional configurations.
   * @returns {Promise<void>}
   *
   * @throws {TypeError} If any column definition is malformed.
   * @throws {Error} If table name is not defined in settings.
   */
  async createTable(columns) {
    const db = this.getDb();
    const tableName = this.#settings?.name;
    if (!tableName || typeof tableName !== 'string')
      throw new Error('Table name not defined in this.#settings.name');

    if (!Array.isArray(columns))
      throw new TypeError(`Expected columns to be an array. Got: ${typeof columns}`);

    // Start building the query
    let query = `CREATE TABLE IF NOT EXISTS ${tableName} (`;

    // Internal processing for SQL only (preserve original for #table)
    const sqlColumns = columns.map((column, i) => {
      if (!Array.isArray(column))
        throw new TypeError(
          `Column definition at index ${i} must be an array. Got: ${typeof column}`,
        );

      const col = [...column]; // shallow clone to avoid mutating original

      // Prepare to detect custom column type
      if (col.length >= 2 && typeof col[1] === 'string') {
        const [name, type] = col;
        if (typeof name !== 'string')
          throw new TypeError(`Expected 'name' to be string in index "${i}", got ${typeof name}`);
        if (typeof type !== 'string')
          throw new TypeError(`Expected 'type' to be string in index "${i}", got ${typeof type}`);
        // Tags
        if (type.toUpperCase() === 'TAGS') {
          col[1] = 'JSON';
          this.#tagColumns[name] = new PuddySqlTags(name);
          this.#tagColumns[name].setIsPgMode(db.getSqlEngine() === 'postgre');
        }
      }

      // If the column definition contains more than two items, it's a full definition
      if (col.length === 3) {
        if (typeof col[0] !== 'string')
          throw new TypeError(
            `Expected 'col[0]' to be string in index "${i}", got ${typeof col[0]}`,
          );
        if (typeof col[1] !== 'string')
          throw new TypeError(
            `Expected 'col[1]' to be string in index "${i}", got ${typeof col[1]}`,
          );
        if (typeof col[2] !== 'string')
          throw new TypeError(
            `Expected 'col[2]' to be string in index "${i}", got ${typeof col[2]}`,
          );
        return `${col[0]} ${col[1]} ${col[2]}`;
      }
      // If only two items are provided, it's just the name and type (no additional configuration)
      else if (col.length === 2) {
        if (typeof col[0] !== 'string')
          throw new TypeError(
            `Expected 'col[0]' to be string in index "${i}", got ${typeof col[0]}`,
          );
        if (typeof col[1] !== 'string')
          throw new TypeError(
            `Expected 'col[1]' to be string in index "${i}", got ${typeof col[1]}`,
          );
        return `${col[0]} ${col[1]}`;
      }
      // If only one item is provided, it's a table setting (e.g., PRIMARY KEY)
      else if (col.length === 1) {
        if (typeof col[0] !== 'string')
          throw new TypeError(
            `Expected 'col[0]' to be string in index "${i}", got ${typeof col[0]}`,
          );
        return col[0];
      }

      throw new TypeError(`Invalid column definition at index ${i}: ${JSON.stringify(col)}`);
    });

    // Join all column definitions into a single string
    query += sqlColumns.join(', ') + ')';

    // Execute the SQL query to create the table using db.run
    await db.run(query, undefined, 'createTable');

    // Save the table structure using an object with column names as keys
    this.#table = {};
    for (const i in columns) {
      const column = columns[i];
      if (column.length >= 2) {
        const [name, type, options] = column;
        if (typeof name !== 'string')
          throw new TypeError(
            `Invalid name of column definition at index ${i}: ${JSON.stringify(column)}`,
          );
        if (typeof type !== 'undefined' && typeof type !== 'string')
          throw new TypeError(
            `Invalid type of column definition at index ${i}: ${JSON.stringify(column)}`,
          );
        if (typeof options !== 'undefined' && typeof options !== 'string')
          throw new TypeError(
            `Invalid options of column definition at index ${i}: ${JSON.stringify(column)}`,
          );
        this.#table[name] = {
          type: typeof type === 'string' ? type.toUpperCase().trim() : null,
          options: typeof options === 'string' ? options.toUpperCase().trim() : null,
        };
      }
    }
  }

  /**
   * Checks whether a column is associated with a tag editor.
   * Tag editors are used for managing tag-based columns in SQL.
   *
   * @param {string} name - The column name to check.
   * @returns {boolean} - Returns true if the column has an associated tag editor.
   */
  hasTagEditor(name) {
    if (this.#tagColumns[name]) return true;
    return false;
  }

  /**
   * Retrieves the PuddySqlTags instance associated with a specific column.
   * Used when the column was defined as a "TAGS" column in the SQL table definition.
   *
   * @param {string} name - The column name to retrieve the tag editor for.
   * @returns {PuddySqlTags} - The tag editor instance.
   * @throws {Error} If the column is not associated with a tag editor.
   */
  getTagEditor(name) {
    if (typeof name !== 'string' || name.length < 1 || !this.hasTagEditor(name))
      throw new Error('Tag editor not found for column: ' + name);
    return this.#tagColumns[name];
  }

  /**
   * Returns a shallow copy of all column-to-tag-editor mappings.
   *
   * @returns {Record<string, PuddySqlTags>} - All tag editor instances mapped by column name.
   */
  getTagEditors() {
    return { ...this.#tagColumns };
  }

  /**
   * Utility functions to sanitize and convert raw database values
   * into proper JavaScript types for JSON compatibility and safe parsing.
   *
   * @type {Record<string, function(any) : unknown>}
   */
  #jsonEscape = {
    /**
     * Converts truthy values to boolean `true`.
     * Accepts: true, "true", 1, "1"
     */
    boolean: (raw) => raw === true || raw === 'true' || raw === 1 || raw === '1',
    /**
     * Converts values into BigInt.
     * Returns `null` if parsing fails or value is invalid.
     */
    bigInt: (raw) => {
      if (typeof raw === 'bigint') return raw;
      else {
        let result;
        try {
          result = BigInt(raw);
        } catch {
          result = null;
        }
        return result;
      }
    },
    /**
     * Converts values to integers using `parseInt`.
     * Floats are truncated if given as numbers.
     * Returns `null` on NaN.
     */
    int: (raw) => {
      let result;
      try {
        result = typeof raw === 'number' ? raw : parseInt(raw);
        result = Math.trunc(result);
        if (Number.isNaN(result)) result = null;
      } catch {
        result = null;
      }
      return result;
    },
    /**
     * Parses values as floating-point numbers.
     * Returns `null` if value is not a valid float.
     */
    float: (raw) => {
      let result;
      try {
        result = typeof raw === 'number' ? raw : parseFloat(raw);
        if (Number.isNaN(result)) result = null;
      } catch {
        result = null;
      }
      return result;
    },
    /**
     * Attempts to parse a string as JSON.
     * If already an object or array, returns the value as-is.
     * Otherwise returns `null` on failure.
     */
    json: (raw) => {
      if (typeof raw === 'string') {
        let result;
        try {
          result = JSON.parse(raw);
        } catch {
          result = null;
        }
        return result;
      } else if (Array.isArray(raw) || isJsonObject(raw)) return raw;
      return null;
    },
    /**
     * Parses or sanitizes tag input to ensure it is a valid array of strings.
     * - If the input is a JSON string, attempts to parse it as an array.
     * - If the input is already an array, ensures all elements are strings; non-string elements are set to `null`.
     * - Returns `null` if the input is neither a string nor an array, or if parsing fails.
     */
    tags: (raw) => {
      let result;
      if (typeof raw === 'string') {
        try {
          result = JSON.parse(raw);
        } catch {
          result = null;
        }
      }

      if (Array.isArray(result)) {
        for (const index in result) if (typeof result[index] !== 'string') result[index] = null;
        return result;
      }
      return null;
    },
    /**
     * Validates that the value is a string, otherwise returns `null`.
     */
    text: (raw) => (typeof raw === 'string' ? raw : null),
    /**
     * Converts the value into a valid Date object.
     * Returns the original date if already valid,
     * or a new Date instance if parsable.
     * Returns `null` if parsing fails.
     */
    date: (raw) => {
      let date;
      try {
        date = raw instanceof Date ? raw : new Date(raw);
      } catch {
        date = null;
      }
      if (date !== null) return Number.isNaN(date.getTime()) ? null : date; // Valid date
      return null;
    },
  };

  /**
   * Maps SQL data types (as returned from metadata or schema)
   * to the appropriate conversion function from #jsonEscape.
   *
   * @type {Record<string, function(any) : unknown>}
   */
  #jsonEscapeAlias = {
    // Boolean aliases
    BOOLEAN: (raw) => this.#jsonEscape.boolean(raw),
    BOOL: (raw) => this.#jsonEscape.boolean(raw),

    // BigInt-compatible numeric types
    BIGINT: (raw) => this.#jsonEscape.bigInt(raw),
    DECIMAL: (raw) => this.#jsonEscape.bigInt(raw),
    NUMERIC: (raw) => this.#jsonEscape.bigInt(raw),

    // Integer aliases
    INTEGER: (raw) => this.#jsonEscape.int(raw),
    INT: (raw) => this.#jsonEscape.int(raw),
    SMALLINT: (raw) => this.#jsonEscape.int(raw),
    TINYINT: (raw) => this.#jsonEscape.int(raw),

    // Floating-point types
    REAL: (raw) => this.#jsonEscape.float(raw),
    FLOAT: (raw) => this.#jsonEscape.float(raw),
    DOUBLE: (raw) => this.#jsonEscape.float(raw),

    // JSON-compatible field
    JSON: (raw) => this.#jsonEscape.json(raw),
    TAGS: (raw) => this.#jsonEscape.tags(raw),

    // Textual representations
    TEXT: (raw) => this.#jsonEscape.text(raw),
    CHAR: (raw) => this.#jsonEscape.text(raw),
    VARCHAR: (raw) => this.#jsonEscape.text(raw),
    CLOB: (raw) => this.#jsonEscape.text(raw),

    // Date/time types
    DATE: (raw) => this.#jsonEscape.date(raw),
    DATETIME: (raw) => this.#jsonEscape.date(raw),
    TIMESTAMP: (raw) => this.#jsonEscape.date(raw),
    TIME: (raw) => this.#jsonEscape.date(raw),
  };

  /**
   * Parses and validates fields from result rows based on SQL types in this.#table.
   * Converts known SQL types to native JS types.
   *
   * Supported types: BOOLEAN, INTEGER, BIGINT, FLOAT, TEXT, JSON, DATE, TIMESTAMP, etc.
   *
   * @param {any} result - The result row to check.
   * @returns {FreeObj}
   */
  resultChecker(result) {
    if (!isJsonObject(result)) return result;
    for (const item in result) {
      const column = this.#table?.[item];
      if (!column || result[item] == null) continue;
      const type = column.type ?? '';
      const raw = result[item];
      if (typeof this.#jsonEscapeAlias[type] === 'function')
        result[item] = this.#jsonEscapeAlias[type](raw);
    }

    return result;
  }

  /**
   * Escapes values inside the valueObj using type definitions from this.#table.
   * Only modifies the values that have a matching column in the table.
   * Uses the appropriate parser from #jsonEscapeAlias.
   * @param {FreeObj} valueObj - The object containing values to be escaped.
   * @returns {FreeObj} The same valueObj with its values escaped according to table definitions.
   */
  escapeValues(valueObj = {}) {
    for (const key in valueObj) {
      if (!valueObj.hasOwnProperty(key)) continue;

      const columnDef = this.#table[key];
      if (columnDef && columnDef.type) {
        const type = columnDef.type.toUpperCase();
        const escapeFn = this.#jsonEscapeAlias[type];

        if (typeof escapeFn === 'function') {
          valueObj[key] = escapeFn.call(this, valueObj[key]);
        }
      }
    }

    return valueObj;
  }

  /**
   * Set or update database settings by merging with existing ones.
   * This function ensures safe fallback values and formats the SELECT clause.
   *
   * @param {TableSettings} [settings={}] - Partial configuration to apply. Will be merged with current settings.
   * @param {PuddySqlEngine} [db] - PuddySql Instance.
   */
  setDb(settings = {}, db) {
    if (!isJsonObject(settings)) throw new TypeError('Settings must be a plain object.');
    if (!(db instanceof PuddySqlEngine))
      throw new Error('Invalid type for db. Expected a PuddySql.');
    this.#db = db;

    const selectValue =
      typeof settings.select !== 'undefined'
        ? this.selectGenerator(settings.select)
        : this.#settings?.select || '*';

    /** @type {Settings} */
    const newSettings = {
      ...this.#settings,
      ...settings,
      select: '',
    };

    newSettings.select = selectValue;

    if (typeof newSettings.join !== 'string') newSettings.join = null;
    if (typeof newSettings.joinCompare !== 'string' && newSettings.join)
      newSettings.joinCompare = 't.key = j.key';
    if (typeof newSettings.order !== 'string') newSettings.order = null;
    if (typeof newSettings.id !== 'string') newSettings.id = 'key';
    if (typeof newSettings.subId !== 'string') newSettings.subId = null;

    this.#settings = newSettings;
  }

  /**
   * Maps database engines to the corresponding property used
   * to check the number of affected rows after a write operation.
   *
   * This is used to abstract the difference between drivers like:
   * - SQLite (uses `changes`)
   * - PostgreSQL (uses `rowCount`)
   *
   * @type {Record<string, string>}
   */
  #resultCounts = {
    sqlite3: 'changes',
    postgre: 'rowCount',
  };

  /**
   * Retrieves the number of affected rows from a database operation result.
   *
   * This method abstracts differences between database engines, such as:
   * - SQLite: returns `result.changes`
   * - PostgreSQL: returns `result.rowCount`
   * - Fallback: `result.rowsAffected`, if defined
   *
   * @param {FreeObj|null} result - The result object returned by the database driver.
   * @returns {number} The number of affected rows, or null if it can't be determined.
   */
  getResultCount(result) {
    const sqlEngine = this.getDb().getSqlEngine();
    if (isJsonObject(result))
      return sqlEngine.length > 0 && typeof result[this.#resultCounts[sqlEngine]] === 'number'
        ? // @ts-ignore
          result[this.#resultCounts[sqlEngine]]
        : typeof result.rowsAffected === 'number'
          ? result.rowsAffected
          : 0;
    return 0;
  }

  /**
   * Check if a row with the given ID (and optional subId) exists.
   * @param {string|number} id - Primary key value.
   * @param {string|number} [subId] - Optional sub-ID for composite key.
   * @returns {Promise<boolean>}
   */
  async has(id, subId) {
    if (typeof id !== 'string' && typeof id !== 'number')
      throw new TypeError(`Expected 'id' to be string or number, got ${typeof id}`);
    if (typeof subId !== 'undefined' && typeof subId !== 'string' && typeof subId !== 'number')
      throw new TypeError(`Expected 'subId' to be string or number, got ${typeof subId}`);
    if (!this.#settings?.name || !this.#settings?.id)
      throw new Error('Invalid table settings: name and id must be defined.');

    const db = this.getDb();
    const useSub =
      this.#settings.subId && (typeof subId === 'string' || typeof subId === 'number')
        ? true
        : false;
    const params = [id];
    const query = `SELECT COUNT(*) FROM ${this.#settings.name} WHERE ${this.#settings.id} = $1${useSub ? ` AND ${this.#settings.subId} = $2` : ''} LIMIT 1`;
    // @ts-ignore
    if (useSub) params.push(subId);

    const result = await db.get(query, params, 'has');
    return isJsonObject(result) && result['COUNT(*)'] === 1 ? true : false;
  }

  /**
   * Type-specific value transformers for preparing data before insertion or update.
   * This object maps column types to functions that transform values accordingly.
   * Used internally by escapeValuesFix.
   *
   * @type {Record<string, function(any) : string>}
   */
  #jsonEscapeFix = {
    // Serializes any value into a JSON string.
    JSON: (raw) => JSON.stringify(raw),
    TAGS: (raw) => {
      const result = [];
      for (const tag of raw) {
        if (typeof tag === 'string') result.push(tag);
        else throw new TypeError('Invalid tag format: each tag must be a string.');
      }
      return JSON.stringify(result);
    },
  };

  /**
   * Applies type-specific escaping to a single value based on the table's column definition.
   * @param {any} v - The raw value to be escaped.
   * @param {string} name - The column name associated with the value.
   * @returns {any} The escaped value if a valid type and handler exist; otherwise, the original value.
   */
  escapeValuesFix(v, name) {
    const column = this.#table?.[name];
    if (!isJsonObject(column))
      throw new Error(`Column "${name}" does not exist in the table definition.`);
    const type = column.type ?? '';
    const func = this.#jsonEscapeFix[type];
    if (typeof func !== 'function') return v;
    else return func(v);
  }

  /**
   * Updates records based on a complex WHERE clause defined by a filter object.
   * Instead of relying solely on an ID (or subId), this method uses parseWhere to
   * generate the conditions, and updates the given fields in valueObj.
   *
   * @param {FreeObj} valueObj - An object representing the columns and new values for the update.
   * @param {QueryGroup} filter - An object containing the conditions for the WHERE clause.
   * @returns {Promise<number>} - Count of rows that were updated.
   */
  async advancedUpdate(valueObj = {}, filter = {}) {
    const db = this.getDb();
    // Validate parameters
    if (!isJsonObject(filter)) throw new Error('Invalid filter object for advancedUpdate');
    if (!isJsonObject(valueObj) || Object.keys(valueObj).length === 0)
      throw new Error('No update values provided for advancedUpdate');

    // Set the SET clause and its parameters
    const columns = Object.keys(valueObj);
    const updateValues = Object.values(valueObj).map((v, index) =>
      this.escapeValuesFix(v, columns[index]),
    );
    const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');

    // Creates a parameter cache for WHERE.
    // The initial index should be equal to updateValues.length + 1 to maintain the correct sequence.
    const whereCache = { index: updateValues.length + 1, values: [] };
    const whereClause = this.parseWhere(whereCache, filter);
    if (!whereClause) {
      throw new Error('Empty WHERE clause — update aborted for safety');
    }

    // Build the complete query
    const query = `UPDATE ${this.#settings.name} SET ${setClause} WHERE ${whereClause}`;
    const params = [...updateValues, ...whereCache.values];

    const result = await db.run(query, params, 'advancedUpdate');
    return this.getResultCount(result);
  }

  /**
   * Update an existing record with given data.
   * Will not insert if the record doesn't exist.
   * @param {string|number} id - Primary key value.
   * @param {FreeObj} valueObj - Data to update.
   * @returns {Promise<number>} Count of rows were updated.
   */
  async update(id, valueObj = {}) {
    const db = this.getDb();
    if (typeof id !== 'string' && typeof id !== 'number')
      throw new TypeError(`Expected 'id' to be string or number, got ${typeof id}`);
    if (!isJsonObject(valueObj) || Object.keys(valueObj).length === 0)
      throw new Error('No update values provided for update');

    const columns = Object.keys(valueObj);
    const values = Object.values(valueObj).map((v, index) =>
      this.escapeValuesFix(v, columns[index]),
    );

    const setClause = columns.map((col, index) => `${col} = $${index + 1}`).join(', ');

    const useSub = this.#settings.subId && typeof valueObj[this.#settings.subId] !== 'undefined';
    const query = `UPDATE ${this.#settings.name} SET ${setClause} WHERE ${this.#settings.id} = $${columns.length + 1}${useSub ? ` AND ${this.#settings.subId} = $${columns.length + 2}` : ''}`;

    const params = [...values, id];
    // @ts-ignore
    if (useSub) params.push(valueObj[this.#settings.subId]);

    const result = await db.run(query, params, 'update');
    return this.getResultCount(result);
  }

  /**
   * Insert or update one or more records with given data.
   *
   * ⚠️ **Important:** The table must have both `id` and `subId` configured as a composite **PRIMARY KEY**
   * (or as a **UNIQUE constraint**) for the upsert operation to work correctly with conflict resolution.
   *
   * If `valueObj` is an array, `id` must also be an array of the same length.
   * All objects inside the array must have identical keys.
   *
   * @param {string|number|Array<string|number>} id - Primary key value(s) for each record.
   * @param {FreeObj|FreeObj[]} valueObj - A single object or an array of objects containing the data to store.
   * @param {boolean} [onlyIfNew=false] - If true, only insert if the record(s) do not already exist.
   * @returns {Promise<FreeObj|FreeObj[]|null>} - Generated values will be returned, or null if nothing was generated.
   * @throws {Error} If `valueObj` is an array and `id` is not an array of the same length,
   *                 or if objects in `valueObj` array have mismatched keys.
   */
  async set(id, valueObj = {}, onlyIfNew = false) {
    const db = this.getDb();
    // Validate 'onlyIfNew'
    if (typeof onlyIfNew !== 'boolean')
      throw new TypeError(`Expected 'onlyIfNew' to be a boolean, but got ${typeof onlyIfNew}`);

    // Validate 'valueObj'
    const isValidArray = Array.isArray(valueObj);
    if (!isValidArray && !isJsonObject(valueObj))
      throw new TypeError(
        `Expected 'valueObj' to be an object or array of objects. Got: ${typeof valueObj}`,
      );

    // Validate empty object
    if (!isValidArray && Object.keys(valueObj).length === 0)
      throw new Error(`No update values provided for 'set()'`);

    // Array form validations
    if (isValidArray) {
      if (!Array.isArray(id))
        throw new TypeError(
          `When 'valueObj' is an array, 'id' must also be an array (got ${typeof id})`,
        );

      if (id.length !== valueObj.length)
        throw new Error(
          `Length mismatch: 'id' has ${id.length} items, but 'valueObj' has ${valueObj.length}`,
        );

      // Validate that all entries in valueObj are valid objects with the same keys
      const expectedKeys = Object.keys(valueObj[0] ?? {});
      for (let i = 0; i < valueObj.length; i++) {
        const obj = valueObj[i];
        if (!isJsonObject(obj))
          throw new TypeError(`Item at index ${i} in 'valueObj' is not a valid object`);

        const keys = Object.keys(obj);
        if (keys.length !== expectedKeys.length || !keys.every((k) => expectedKeys.includes(k)))
          throw new Error(
            `Mismatched keys in 'valueObj' at index ${i}. Expected: [${expectedKeys.join(', ')}], got: [${keys.join(', ')}]`,
          );
      }
    } else {
      // Single ID mode
      if (typeof id !== 'string' && typeof id !== 'number')
        throw new TypeError(`Expected 'id' to be a string or number when using single value mode`);
    }

    // Prepare validator
    const isArray = Array.isArray(valueObj);
    const objects = isArray ? valueObj : [valueObj];
    const ids = isArray ? (Array.isArray(id) ? id : []) : [id];

    // Check if all objects have the same id amount
    if (objects.length === 0) return null;
    if (isArray && ids.length !== objects.length)
      throw new Error('When valueObj is an array, id must also be an array of the same length');

    const columns = Object.keys(objects[0]);

    // Check if all objects have the same keys
    for (let i = 1; i < objects.length; i++) {
      const keys = Object.keys(objects[i]);
      if (keys.length !== columns.length || !columns.every((col) => keys.includes(col))) {
        throw new Error('All objects in valueObj array must have the same keys');
      }
    }

    // Prepare values
    const allParams = [];
    const valuePlaceholders = [];

    // Insert content
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const rowId = isArray ? ids[i] : ids[0];
      const values = [rowId, ...columns.map((col) => this.escapeValuesFix(obj[col], col))];
      allParams.push(...values);

      const offset = i * (columns.length + 1); // +1 for ID
      const placeholders = values.map((_, idx) => `$${offset + idx + 1}`).join(', ');
      valuePlaceholders.push(`(${placeholders})`);
    }

    let query = `INSERT INTO ${this.#settings.name} (${this.#settings.id}, ${columns.join(', ')}) 
                   VALUES ${valuePlaceholders.join(', ')}`;

    if (!onlyIfNew) {
      const updateClause = columns.map((col) => `${col} = excluded.${col}`).join(', ');
      query += ` ON CONFLICT(${this.#settings.id}${this.#settings.subId ? `, ${this.#settings.subId}` : ''}) 
                   DO UPDATE SET ${updateClause}`;
    } else {
      query += ` ON CONFLICT(${this.#settings.id}${this.#settings.subId ? `, ${this.#settings.subId}` : ''}) DO NOTHING`;
    }

    // Add returning ids to generated keys
    const genIds = [];
    let returnIds = '';
    for (const item in this.#table) {
      const column = this.#table?.[item];
      if (typeof objects[0][item] !== 'undefined') continue;
      const options = column.options || '';
      if (
        options.includes('PRIMARY KEY') ||
        options.includes('GENERATED ') ||
        options.includes('DEFAULT ')
      ) {
        if (returnIds.length > 0) returnIds += ', ';
        returnIds += item;
        genIds.push(item);
      }
    }
    if (genIds.length > 0) query += ` RETURNING ${returnIds}`;

    // Complete!
    const result = await (isArray
      ? db.all(query, allParams, 'multi-set')
      : db.get(query, allParams, 'set'));
    return result || null;
  }

  /**
   * Get a record by its ID (and optional subId).
   * @param {string|number} id - Primary key value.
   * @param {string|number} [subId] - Optional sub-ID for composite key.
   * @returns {Promise<FreeObj|null>}
   */
  async get(id, subId) {
    if (typeof id !== 'string' && typeof id !== 'number')
      throw new TypeError(`Expected 'id' to be string or number, got ${typeof id}`);
    if (typeof subId !== 'undefined' && typeof subId !== 'string' && typeof subId !== 'number')
      throw new TypeError(`Expected 'subId' to be string or number, got ${typeof subId}`);

    const db = this.getDb();
    const useSub =
      this.#settings.subId && (typeof subId === 'string' || typeof subId === 'number')
        ? true
        : false;
    const params = [id];
    const query = `SELECT ${this.#settings.select} FROM ${this.#settings.name} t 
                     ${this.insertJoin()} WHERE t.${this.#settings.id} = $1${useSub ? ` AND t.${this.#settings.subId} = $2` : ''}`;
    // @ts-ignore
    if (useSub) params.push(subId);
    const result = this.resultChecker(await db.get(query, params, 'get'));
    if (!result) return null;
    return result;
  }

  /**
   * Delete records based on a complex WHERE clause using a filter object.
   *
   * Uses the internal parseWhere method to build a flexible condition set.
   *
   * @param {QueryGroup} filter - An object containing the WHERE condition(s).
   * @returns {Promise<number>} - Number of rows deleted.
   */
  async advancedDelete(filter = {}) {
    const db = this.getDb();
    if (!isJsonObject(filter)) {
      throw new Error('Invalid filter object for advancedDelete');
    }

    /** @type {Pcache} */
    const pCache = { index: 1, values: [] };
    const whereClause = this.parseWhere(pCache, filter);
    if (!whereClause) throw new Error('Empty WHERE clause — deletion aborted for safety');

    const query = `DELETE FROM ${this.#settings.name} WHERE ${whereClause}`;
    const result = await db.run(query, pCache.values, 'advancedDelete');
    return this.getResultCount(result);
  }

  /**
   * Delete a record by its ID (and optional subId).
   * @param {string|number} id - Primary key value.
   * @param {string|number} [subId] - Optional sub-ID for composite key.
   * @returns {Promise<number>} - Count of rows were updated.
   */
  async delete(id, subId) {
    if (typeof id !== 'string' && typeof id !== 'number')
      throw new TypeError(`Expected 'id' to be string or number, got ${typeof id}`);
    if (typeof subId !== 'undefined' && typeof subId !== 'string' && typeof subId !== 'number')
      throw new TypeError(`Expected 'subId' to be string or number, got ${typeof subId}`);

    const db = this.getDb();
    const useSub =
      this.#settings.subId && (typeof subId === 'string' || typeof subId === 'number')
        ? true
        : false;
    const query = `DELETE FROM ${this.#settings.name} WHERE ${this.#settings.id} = $1${useSub ? ` AND ${this.#settings.subId} = $2` : ''}`;
    const params = [id];
    // @ts-ignore
    if (useSub) params.push(subId);

    const result = await db.run(query, params, 'delete');
    return this.getResultCount(result);
  }

  /**
   * Get a limited number of rows from the database.
   * If an ID is provided, returns only the matching record(s) up to the specified count.
   * @param {number} count - Number of rows to retrieve.
   * @param {string|number|null} [filterId=null] - Optional ID to filter by.
   * @param {SelectQuery} [selectValue='*'] - Defines which columns or expressions should be selected in the query.
   * @returns {Promise<FreeObj[]>}
   */
  async getAmount(count, filterId = null, selectValue = '*') {
    const db = this.getDb();
    if (typeof count !== 'number')
      throw new TypeError(`Expected 'count' to be number, got ${typeof count}`);
    if (filterId !== null && typeof filterId !== 'string' && typeof filterId !== 'number')
      throw new TypeError(`Expected 'filterId' to be string or number, got ${typeof filterId}`);

    const orderClause = this.#settings.order ? `ORDER BY ${this.#settings.order}` : '';
    const whereClause = filterId !== null ? `WHERE t.${this.#settings.id} = $1` : '';
    const limitClause = `LIMIT $${filterId !== null ? 2 : 1}`;
    const query = `SELECT ${this.selectGenerator(selectValue)} FROM ${this.#settings.name} t 
                   ${this.insertJoin()} 
                   ${whereClause}
                   ${orderClause} ${limitClause}`.trim();

    const params = filterId !== null ? [filterId, count] : [count];
    const results = await db.all(query, params, 'getAmount');
    for (const index in results) this.resultChecker(results[index]);
    return results;
  }

  /**
   * Get all records from the table.
   * If an ID is provided, returns only the matching record(s).
   * @param {string|number|null} [filterId=null] - Optional ID to filter by.
   * @param {SelectQuery} [selectValue='*'] - Defines which columns or expressions should be selected in the query.
   * @returns {Promise<FreeObj[]>}
   */
  async getAll(filterId = null, selectValue = '*') {
    if (filterId !== null && typeof filterId !== 'string' && typeof filterId !== 'number')
      throw new TypeError(`Expected 'filterId' to be string or number, got ${typeof filterId}`);
    const db = this.getDb();
    const orderClause = this.#settings.order ? `ORDER BY ${this.#settings.order}` : '';
    const whereClause = filterId !== null ? `WHERE t.${this.#settings.id} = $1` : '';
    const query = `SELECT ${this.selectGenerator(selectValue)} FROM ${this.#settings.name} t 
                   ${this.insertJoin()} 
                   ${whereClause}
                   ${orderClause}`.trim();

    const results = await db.all(query, filterId !== null ? [filterId] : [], 'getAll');
    for (const index in results) this.resultChecker(results[index]);
    return results;
  }

  /**
   * Executes a paginated query and returns results, total pages, and total item count.
   *
   * @param {string} query - The base SQL query (should not include LIMIT or OFFSET).
   * @param {any[]} params - The parameters for the SQL query.
   * @param {number} perPage - The number of items per page.
   * @param {number} page - The current page number (starting from 1).
   * @param {string} queryName - The query name to insert into the sql debug.
   * @returns {Promise<PaginationResult>}
   */
  async execPagination(query, params, perPage, page, queryName = '') {
    if (typeof query !== 'string')
      throw new TypeError(`Expected 'query' to be a string, got ${typeof query}`);
    if (!Array.isArray(params))
      throw new TypeError(`Expected 'params' to be an array, got ${typeof params}`);
    if (!Number.isInteger(perPage) || perPage < 0)
      throw new RangeError(`'perPage' must be a non-negative integer. Received: ${perPage}`);
    if (!Number.isInteger(page) || page < 1)
      throw new RangeError(`'page' must be an integer >= 1. Received: ${page}`);
    if (typeof queryName !== 'string')
      throw new TypeError(`Expected 'queryName' to be a string, got ${typeof queryName}`);

    const db = this.getDb();
    const offset = (page - 1) * perPage;
    const isZero = perPage < 1;

    // Count total items
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) AS count_wrapper`;
    const countResult = !isZero
      ? await db.get(countQuery, params, `pagination-${queryName}`)
      : { total: 0 };

    const total = isJsonObject(countResult)
      ? typeof countResult.total === 'number' &&
        !Number.isNaN(countResult.total) &&
        Number.isFinite(countResult.total) &&
        countResult.total >= 0
        ? countResult.total
        : 0
      : 0;

    // Fetch paginated items
    const paginatedQuery = `${query} LIMIT ? OFFSET ?`;
    const items = !isZero
      ? await db.all(paginatedQuery, [...params, perPage, offset], `pagination-${queryName}`)
      : [];

    const totalPages = !isZero ? Math.ceil(total / perPage) : 0;
    for (const index in items) this.resultChecker(items[index]);

    return {
      items,
      totalPages,
      totalItems: total,
    };
  }

  /**
   * Builds a SQL WHERE clause from a nested or flat condition structure.
   *
   * This internal helper method parses logical groupings (AND/OR) and formats the conditions into
   * SQL syntax, while managing parameter placeholders and values.
   *
   * It supports:
   * - Nested condition groups via `group` and `conditions`.
   * - Flat object-based filtering (legacy/fallback support).
   * - Single-condition objects.
   * - Dynamic operators through the internal `#conditions` handler.
   *
   * @param {Pcache} [pCache={ index: 1, values: [] }] - Placeholder cache object.
   * @param {QueryGroup} [group={}] - Grouped or single filter condition.
   * @returns {string} SQL-formatted WHERE clause (without the "WHERE" keyword).
   *
   * @example
   * const pCache = { index: 1, values: [] };
   * const clause = this.parseWhere(pCache, {
   *   group: 'OR',
   *   conditions: [
   *     { column: 'status', value: 'active' },
   *     { column: 'role', value: 'admin', operator: '=' }
   *   ]
   * });
   * // clause: "(status = $1) OR (role = $2)"
   * // pCache.values: ['active', 'admin']
   */
  parseWhere(pCache = { index: 1, values: [] }, group = {}) {
    if (!isJsonObject(pCache) || !isJsonObject(group)) return '';
    if (typeof pCache.index !== 'number') pCache.index = 1;
    if (!Array.isArray(pCache.values)) pCache.values = [];

    if (Array.isArray(group.conditions)) {
      const logic =
        typeof group.group === 'string' && group.group.toUpperCase() === 'OR' ? 'OR' : 'AND';
      const innerConditions = group.conditions.map((cond) => {
        return `(${this.parseWhere(pCache, cond)})`;
      });
      return innerConditions.join(` ${logic} `);
    }

    /**
     * @param {*} valType
     * @returns {string}
     */
    const getParamResult = (valType) => {
      if (typeof pCache.index !== 'number') throw new Error('Invalid pCache index');
      const newIndex = pCache.index++;
      return typeof this.#customValFunc[valType] === 'function'
        ? this.#customValFunc[valType](`$${newIndex}`)
        : `$${newIndex}`;
    };

    // Flat object fallback for backward compatibility
    if (!group.column) {
      const entries = Object.entries(group);
      const logic = 'AND';
      const innerConditions = entries.map(([newCol, cond]) => {
        if (!isJsonObject(cond)) throw new Error(`Invalid parseWhere to col ${newCol}.`);
        let col = newCol;
        let operator = '=';
        let value = cond.value;
        let valType = cond.valType;

        if (typeof cond.operator === 'string') {
          const selected = cond.operator.toUpperCase();
          if (typeof this.#conditions[selected] === 'function') {
            const result = this.#conditions[selected](cond);
            if (typeof result.operator === 'string') operator = result.operator;
            if (typeof result.value !== 'undefined') value = result.value;
            if (typeof result.column === 'string') col = result.column;
            if (typeof result.valType === 'string') valType = result.valType;
          }
        }

        if (!Array.isArray(pCache.values)) throw new Error('Invalid pCache values');
        pCache.values.push(value);
        return `(${col} ${operator} $${getParamResult(valType)})`;
      });
      return innerConditions.join(` ${logic} `);
    }

    // If it's a single condition
    let col = group.column;
    let operator = '=';
    let value = group.value;
    let valType = group.valType;

    if (typeof group.operator === 'string') {
      const selected = group.operator.toUpperCase();
      if (typeof this.#conditions[selected] === 'function') {
        const result = this.#conditions[selected](group);
        if (typeof result.operator === 'string') operator = result.operator;
        if (typeof result.column === 'string') col = result.column;
        if (typeof result.valType === 'string') valType = result.valType;
        if (typeof result.value !== 'undefined') value = result.value;
      }
    }

    pCache.values.push(value);
    return `${col} ${operator} ${getParamResult(valType)}`;
  }

  /**
   * Generates a default LEFT JOIN clause based on internal settings.
   *
   * This method is used as a fallback when no custom join is provided.
   * It expects `this.#settings.join` to be a string containing the table name,
   * and `this.#settings.joinCompare` to be the ON condition.
   *
   * @returns {string} The default LEFT JOIN SQL snippet, or an empty string if no join is configured.
   */
  insertJoin() {
    return typeof this.#settings.join === 'string'
      ? `LEFT JOIN ${this.#settings.join} j ON ${this.#settings.joinCompare ?? ''}`
      : '';
  }

  /**
   * An object containing standard SQL JOIN types.
   * Each property represents a commonly used SQL JOIN keyword.
   * These JOINs define how to combine rows from two or more tables.
   */
  #joinTypes = {
    /**
     * INNER JOIN:
     * Returns only the rows where there is a match in both tables.
     * This is the most commonly used JOIN.
     *
     * Example:
     * SELECT * FROM table1
     * INNER JOIN table2 ON table1.id = table2.fk_id;
     */
    inner: 'INNER JOIN',

    /**
     * LEFT JOIN (or LEFT OUTER JOIN):
     * Returns all rows from the left table, and matched rows from the right table.
     * If there is no match, the result will contain NULLs for the right table.
     *
     * Example:
     * SELECT * FROM table1
     * LEFT JOIN table2 ON table1.id = table2.fk_id;
     */
    left: 'LEFT JOIN',

    /**
     * RIGHT JOIN (or RIGHT OUTER JOIN):
     * Returns all rows from the right table, and matched rows from the left table.
     * If there is no match, the result will contain NULLs for the left table.
     *
     * Example:
     * SELECT * FROM table1
     * RIGHT JOIN table2 ON table1.id = table2.fk_id;
     */
    right: 'RIGHT JOIN',

    /**
     * FULL JOIN (or FULL OUTER JOIN):
     * Returns all rows from both tables.
     * If there is no match, NULLs will be returned for the missing side.
     *
     * Example:
     * SELECT * FROM table1
     * FULL OUTER JOIN table2 ON table1.id = table2.fk_id;
     */
    full: 'FULL JOIN',

    /**
     * CROSS JOIN:
     * Returns the Cartesian product of both tables.
     * Every row from the first table is combined with every row from the second table.
     *
     * Example:
     * SELECT * FROM table1
     * CROSS JOIN table2;
     */
    cross: 'CROSS JOIN',

    /**
     * JOIN (default syntax, behaves like INNER JOIN):
     * Equivalent to INNER JOIN when used without LEFT/RIGHT/FULL keywords.
     * This is just a shorthand and often used in quick queries.
     *
     * Example:
     * SELECT * FROM table1
     * JOIN table2 ON table1.id = table2.fk_id;
     */
    join: 'JOIN',
  };

  /**
   * Parses and generates JOIN clauses based on the provided configuration.
   *
   * Supports multiple formats:
   * - If `join` is a single object: returns a single JOIN clause.
   * - If `join` is an array of objects: generates multiple JOINs with aliases (`j1`, `j2`, ...).
   * - If `join` is invalid or empty: falls back to `insertJoin()` using internal settings.
   *
   * @param {JoinObj|JoinObj[]|string|null} [join] - The join configuration(s).
   * @returns {string} One or more JOIN SQL snippets.
   */
  parseJoin(join) {
    /**
     * @param {JoinObj} j
     * @param {number} idx
     * @returns {string}
     */
    const insertJoin = (j, idx) => {
      const alias = `j${idx + 1}`;
      const typeKey = typeof j.type === 'string' ? j.type.toLowerCase() : 'left';
      // @ts-ignore
      const joinType = this.#joinTypes[typeKey];

      if (typeof joinType !== 'string') {
        throw new Error(
          `Invalid JOIN type: '${j.type}'. Supported types: ${Object.keys(this.#joinTypes).join(', ')}`,
        );
      }

      return `${joinType} ${j.table} ${alias} ON ${j.compare}`;
    };

    return isJsonObject(join)
      ? [join].map(insertJoin).join(' ')
      : Array.isArray(join)
        ? join.map(insertJoin).join(' ')
        : typeof join === 'string'
          ? join
          : this.insertJoin();
  }

  /**
   * Finds the first item matching the filter, along with its position, page, and total info.
   * Uses a single SQL query to calculate everything efficiently.
   *
   * If selectValue is null, it only returns the pagination/position data, not the item itself.
   *
   * @param {Object} [searchData={}] - Main search configuration.
   * @param {QueryGroup} [searchData.q={}] - Nested criteria object.
   * @param {TagCriteria[]|TagCriteria|null} [searchData.tagCriteria] - One or multiple tag criteria groups.
   * @param {string[]} [searchData.tagCriteriaOps] - Optional logical operators between tag groups (e.g., ['AND', 'OR']).
   * @param {boolean} [searchData.isFlatTags=false] - Use the parseWhereFlat mode to tags.
   * @param {number} [searchData.perPage] - Number of items per page.
   * @param {SelectQuery} [searchData.select='*'] - Which columns to select. Set to null to skip item data.
   * @param {string} [searchData.order] - SQL ORDER BY clause. Defaults to configured order.
   * @param {string|JoinObj|JoinObj[]} [searchData.join] - JOIN definitions with table, compare, and optional type.
   * @returns {{ query: string; values: any[] | undefined; perPage: number; selectValue: SelectQuery; }}
   * @throws {Error} If searchData has invalid structure or values.
   */
  findQuery(searchData = {}) {
    // --- Validate searchData types ---
    if (!isJsonObject(searchData)) throw new TypeError(`'searchData' must be a object`);
    const criteria = searchData.q ?? {};
    const tagCriteria = searchData.tagCriteria ?? null;
    const isFlatTags = searchData.isFlatTags ?? false;
    const tagCriteriaOps = Array.isArray(searchData.tagCriteriaOps)
      ? searchData.tagCriteriaOps
      : [];

    const selectValue = searchData.select ?? '*';
    const perPage = searchData.perPage ?? null;
    const order = searchData.order ?? this.#settings.order;
    const joinConfig = searchData.join ?? null;

    if (!isJsonObject(criteria))
      throw new TypeError(`'searchData.q' must be a plain object or nested QueryGroup`);

    if (perPage == null || typeof perPage !== 'number' || !Number.isInteger(perPage) || perPage < 1)
      throw new TypeError(`'searchData.perPage' must be a positive integer (≥ 1), got: ${perPage}`);

    if (
      selectValue !== null &&
      typeof selectValue !== 'string' &&
      !Array.isArray(selectValue) &&
      !isJsonObject(selectValue)
    )
      throw new TypeError(`'searchData.select' must be a string, array, object or null`);

    if (order !== undefined && order !== null && typeof order !== 'string')
      throw new TypeError(`'searchData.order' must be a string if defined`);

    if (
      joinConfig !== null &&
      typeof joinConfig !== 'string' &&
      !Array.isArray(joinConfig) &&
      !isJsonObject(joinConfig)
    )
      throw new TypeError(`'searchData.join' must be a string, object, array, or null`);

    /** @type {Pcache} */
    const pCache = { index: 1, values: [] };
    const whereParts = [];

    // Apply base criteria
    if (Object.keys(criteria).length) {
      whereParts.push(this.parseWhere(pCache, criteria));
    }

    // Apply tagCriteria logic
    if (Array.isArray(tagCriteria)) {
      tagCriteria.forEach((group, i) => {
        if (!isJsonObject(group) || typeof group.column !== 'string')
          throw new TypeError(`Each item in 'tagCriteria' must be an object`);
        if (typeof group.column !== 'undefined' && typeof group.column !== 'string')
          throw new TypeError(`'group.column' must be a string if defined`);

        const tag = this.getTagEditor(group.column);
        const clause = !isFlatTags
          ? tag.parseWhere(group, pCache)
          : tag.parseWhereFlat(group, pCache);
        if (!clause) return;

        const op = i > 0 ? tagCriteriaOps[i - 1] || 'AND' : null;
        if (op) whereParts.push(op);
        whereParts.push(clause);
      });
    } else if (isJsonObject(tagCriteria) && typeof tagCriteria.column === 'string') {
      if (typeof tagCriteria.column !== 'undefined' && typeof tagCriteria.column !== 'string')
        throw new TypeError(`'tagCriteria.column' must be a string if defined`);

      const tag = this.getTagEditor(tagCriteria.column);
      const clause = !isFlatTags
        ? tag.parseWhere(tagCriteria, pCache)
        : tag.parseWhereFlat(tagCriteria, pCache);
      if (clause) whereParts.push(clause);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' ')}` : '';
    const orderClause = order ? `ORDER BY ${order}` : '';

    // Avoid selecting data if selectValue is null
    const selectedColumns = selectValue === null ? '' : `${this.selectGenerator(selectValue)},`;

    const query = `
    WITH matched AS (
      SELECT ${selectedColumns}
             ROW_NUMBER() OVER (${orderClause || 'ORDER BY (SELECT 1)'}) AS rn,
             COUNT(*) OVER () AS total
      FROM ${this.#settings.name} t
      ${this.parseJoin(joinConfig)}
      ${whereClause}
    )
    SELECT *, rn AS position, CEIL(CAST(total AS FLOAT) / ${perPage}) AS pages
    FROM matched
    WHERE rn = 1
  `.trim();

    return { query, values: pCache.values, perPage, selectValue };
  }

  /**
   * Finds the first item matching the filter, along with its position, page, and total info.
   * Uses a single SQL query to calculate everything efficiently.
   *
   * If selectValue is null, it only returns the pagination/position data, not the item itself.
   *
   * @param {Object} [searchData={}] - Main search configuration.
   * @param {QueryGroup} [searchData.q={}] - Nested criteria object.
   * @param {TagCriteria[]|TagCriteria|null} [searchData.tagCriteria] - One or multiple tag criteria groups.
   * @param {string[]} [searchData.tagCriteriaOps] - Optional logical operators between tag groups (e.g., ['AND', 'OR']).
   * @param {number} [searchData.perPage] - Number of items per page.
   * @param {SelectQuery} [searchData.select='*'] - Which columns to select. Set to null to skip item data.
   * @param {string} [searchData.order] - SQL ORDER BY clause. Defaults to configured order.
   * @param {string|JoinObj|JoinObj[]} [searchData.join] - JOIN definitions with table, compare, and optional type.
   * @returns {Promise<FindResult | null>}
   * @throws {Error} If searchData has invalid structure or values.
   */
  async find(searchData = {}) {
    const db = this.getDb();
    const { query, values, perPage, selectValue } = this.findQuery(searchData);

    const row = await db.get(query, values, 'find');
    if (!row) return null;

    const total = parseInt(row.total);
    const pages = parseInt(row.pages);
    const position = parseInt(row.position);
    const page = Math.floor((position - 1) / perPage) + 1;

    /** @type {FindResult} */
    const response = { page, pages, total, position };

    // If selectValue is NOT null, return the item
    if (selectValue !== null) {
      delete row.rn;
      delete row.total;
      delete row.pages;
      delete row.position;

      this.resultChecker(row);
      response.item = row;
    }

    // Complete
    return response;
  }

  /**
   * Perform a filtered search with advanced nested criteria, pagination, and customizable settings.
   *
   * Supports complex logical groupings (AND/OR), flat condition style, custom ordering, and single or multiple joins.
   * Pagination can be enabled using `perPage`, and additional settings like `order`, `join`, and `limit` can be passed inside `searchData`.
   *
   * @param {Object} [searchData={}] - Main search configuration.
   * @param {QueryGroup} [searchData.q={}] - Nested criteria object.
   *        Can be a flat object style or grouped with `{ group: 'AND'|'OR', conditions: [...] }`.
   * @param {TagCriteria[]|TagCriteria|null} [searchData.tagsQ] - One or multiple tag criteria groups.
   * @param {string[]} [searchData.tagsOpsQ] - Optional logical operators between tag groups (e.g., ['AND', 'OR']).
   * @param {SelectQuery} [searchData.select='*'] - Defines which columns or expressions should be selected in the query.
   * @param {number|null} [searchData.perPage=null] - Number of results per page. If set, pagination is applied.
   * @param {boolean} [searchData.isFlatTags=false] - Use the parseWhereFlat mode to tags.
   * @param {number} [searchData.page=1] - Page number to retrieve when `perPage` is used.
   * @param {string} [searchData.order] - Custom `ORDER BY` clause (e.g. `'created_at DESC'`).
   * @param {string|JoinObj|JoinObj[]} [searchData.join] - A string for single join or array of objects for multiple joins.
   *        Each object should contain `{ table: 'name', compare: 'ON clause' }`.
   * @param {number} [searchData.limit] - Max number of results to return (ignored when `perPage` is used).
   * @returns {{ query: string; perPage: number | null; values: any[]; page: number; }}
   * @throws {Error} If searchData has invalid structure or values.
   *
   * @example
   * // Flat search:
   * await table.search({ q: { status: { value: 'active' } } });
   *
   * // Grouped search:
   * await table.search({
   *   q: {
   *     group: 'AND',
   *     conditions: [
   *       { column: 'status', value: 'active' },
   *       {
   *         group: 'OR',
   *         conditions: [
   *           { column: 'role', value: 'admin' },
   *           { column: 'role', value: 'mod' }
   *         ]
   *       }
   *     ]
   *   }
   * });
   *
   * // With pagination and custom joins:
   * await table.search({
   *   q: { status: { value: 'active' } },
   *   select: '*',
   *   perPage: 10,
   *   page: 2,
   *   join: [
   *     { type: 'left', table: 'profiles', compare: 't.profile_id = j1.id' },
   *     { type: 'left', table: 'roles', compare: 'j1.role_id = j2.id' }
   *   ],
   *   order: 'created_at DESC'
   * });
   */
  searchQuery(searchData = {}) {
    if (!isJsonObject(searchData)) throw new TypeError(`'searchData' must be a object`);
    const order = searchData.order ?? this.#settings.order;
    const join = searchData.join ?? this.#settings.join;
    const limit = searchData.limit ?? null;
    const selectValue = searchData.select ?? '*';
    const perPage = searchData.perPage ?? null;
    const page = searchData.page ?? 1;

    const criteria = searchData.q ?? {};
    const tagCriteria = searchData.tagsQ ?? {};
    const isFlatTags = searchData.isFlatTags ?? false;
    const tagCriteriaOps = searchData.tagsOpsQ;

    // --- Validate searchData types ---
    if (!isJsonObject(criteria))
      throw new TypeError(`'searchData.q' must be a plain object or valid QueryGroup`);

    if (
      selectValue !== null &&
      typeof selectValue !== 'string' &&
      !Array.isArray(selectValue) &&
      !isJsonObject(selectValue)
    )
      throw new TypeError(`'searchData.select' must be a string, array, object or null`);

    if (order !== undefined && order !== null && typeof order !== 'string')
      throw new TypeError(`'searchData.order' must be a string if defined`);

    if (join !== null && typeof join !== 'string' && !Array.isArray(join) && !isJsonObject(join))
      throw new TypeError(`'searchData.join' must be a string, array, object or null`);

    if (limit !== null && typeof limit !== 'number')
      throw new TypeError(`'searchData.limit' must be a number if defined`);

    if (
      perPage !== null &&
      (typeof perPage !== 'number' || !Number.isInteger(perPage) || perPage < 1)
    )
      throw new TypeError(`'searchData.perPage' must be a positive integer if defined`);

    if (typeof page !== 'number' || !Number.isInteger(page) || page < 1)
      throw new TypeError(`'searchData.page' must be a positive integer`);

    if (
      tagCriteria !== undefined &&
      tagCriteria !== null &&
      !Array.isArray(tagCriteria) &&
      !isJsonObject(tagCriteria)
    )
      throw new TypeError(`'searchData.tagsQ' must be an array, object or null`);

    if (tagCriteriaOps !== undefined && tagCriteriaOps !== null && !Array.isArray(tagCriteriaOps))
      throw new TypeError(`'searchData.tagsOpsQ' must be an array if defined`);

    /** @type {Pcache} */
    const pCache = { index: 1, values: [] };

    // Where
    const whereParts = [];

    if (Object.keys(criteria).length) {
      whereParts.push(this.parseWhere(pCache, criteria));
    }

    if (Array.isArray(tagCriteria)) {
      const operators = Array.isArray(tagCriteriaOps) ? tagCriteriaOps : [];

      tagCriteria.forEach((group, i) => {
        if (!isJsonObject(group) || typeof group.column !== 'string')
          throw new TypeError(`Each item in 'tagsQ' must be a valid object`);

        const tag = this.getTagEditor(group.column);
        const clause = !isFlatTags
          ? tag.parseWhere(group, pCache)
          : tag.parseWhereFlat(group, pCache);
        if (!clause) return;

        const op = i > 0 ? operators[i - 1] || 'AND' : null;
        if (op) whereParts.push(op);
        whereParts.push(clause);
      });
    } else if (isJsonObject(tagCriteria) && typeof tagCriteria.column === 'string') {
      const tag = this.getTagEditor(tagCriteria.column);
      const clause = !isFlatTags
        ? tag.parseWhere(tagCriteria, pCache)
        : tag.parseWhereFlat(tagCriteria, pCache);
      if (clause) whereParts.push(clause);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' ')}` : '';
    const { values } = pCache;
    if (!Array.isArray(values)) throw new Error('Invalid pCache.values');

    // Order by
    const orderClause = order ? `ORDER BY ${order}` : '';

    // Limit
    const limitClause =
      typeof perPage === 'number' ? '' : typeof limit === 'number' ? `LIMIT ${limit}` : '';

    // Query
    const query = `SELECT ${this.selectGenerator(selectValue)} FROM ${this.#settings.name} t 
                       ${this.parseJoin(join)} 
                       ${whereClause} 
                       ${orderClause} 
                       ${limitClause}`.trim();

    return { query, perPage, values, page };
  }

  /**
   * Perform a filtered search with advanced nested criteria, pagination, and customizable settings.
   *
   * Supports complex logical groupings (AND/OR), flat condition style, custom ordering, and single or multiple joins.
   * Pagination can be enabled using `perPage`, and additional settings like `order`, `join`, and `limit` can be passed inside `searchData`.
   *
   * @param {Object} [searchData={}] - Main search configuration.
   * @param {QueryGroup} [searchData.q={}] - Nested criteria object.
   *        Can be a flat object style or grouped with `{ group: 'AND'|'OR', conditions: [...] }`.
   * @param {TagCriteria[]|TagCriteria|null} [searchData.tagsQ] - One or multiple tag criteria groups.
   * @param {string[]} [searchData.tagsOpsQ] - Optional logical operators between tag groups (e.g., ['AND', 'OR']).
   * @param {SelectQuery} [searchData.select='*'] - Defines which columns or expressions should be selected in the query.
   * @param {number|null} [searchData.perPage=null] - Number of results per page. If set, pagination is applied.
   * @param {number} [searchData.page=1] - Page number to retrieve when `perPage` is used.
   * @param {string} [searchData.order] - Custom `ORDER BY` clause (e.g. `'created_at DESC'`).
   * @param {string|JoinObj|JoinObj[]} [searchData.join] - A string for single join or array of objects for multiple joins.
   *        Each object should contain `{ table: 'name', compare: 'ON clause' }`.
   * @param {number} [searchData.limit] - Max number of results to return (ignored when `perPage` is used).
   * @returns {Promise<FreeObj[]|PaginationResult>} - Result rows matching the query.
   * @throws {Error} If searchData has invalid structure or values.
   */
  async search(searchData = {}) {
    const db = this.getDb();
    const { query, values, perPage, page } = this.searchQuery(searchData);

    // Results
    let results;

    // Pagination
    if (typeof perPage === 'number' && perPage > -1)
      results = await this.execPagination(query, values, perPage, page, 'search');
    // Normal
    else {
      results = await db.all(query, values, 'search');
      for (const index in results) this.resultChecker(results[index]);
    }

    // Complete
    return results;
  }
}

export default PuddySqlQuery;
