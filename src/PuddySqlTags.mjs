import _ from 'lodash';
import { isJsonObject } from './Utils.mjs';

/** @typedef {{ title: string; parser?: (value: string) => string }} SpecialQuery */
/** @typedef {import('./PuddySqlQuery.mjs').Pcache} Pcache */
/** @typedef {import('./PuddySqlQuery.mjs').TagCriteria} TagCriteria */

/**
 * Represents a key-value pair extracted from a special chunk format.
 *
 * @typedef {Object} SpecialFromChunks
 * @property {string} key - The key or identifier extracted from the chunk.
 * @property {string} value - The associated value linked to the key.
 */

/**
 * Represents a collection of string chunks used in parsing or filtering.
 *
 * @typedef {Array<string | string[]>} Chunks
 *
 * A chunk can be a single string or an array of strings grouped as OR conditions.
 */

/**
 * Result of parsing a string expression into a column and list of included values.
 *
 * @typedef {Object} ParseStringResult
 * @property {string} column - The SQL column to which the values apply.
 * @property {Chunks} include - List of values or grouped OR conditions to be included in the query.
 */

/**
 * Represents a mapping entry for a tag input definition.
 *
 * Each tag input is defined by the name of the list where it belongs (`list`)
 * and the key (`valueKey`) used to extract the relevant value from tag objects.
 * This structure is used to determine how tags are parsed and grouped during search.
 *
 * @typedef {Object} TagInput
 * @property {string} list - The list name where the tag will be added.
 * @property {string} valueKey - The key for the value associated with the tag input.
 */

/**
 * @class PuddySqlTags
 * @description A powerful utility class for building advanced SQL WHERE clauses with support for tag-based filtering,
 * custom boolean logic, wildcard parsing, and special query handlers.
 *
 * PuddySqlTags provides a structured way to interpret and transform flexible user search input into robust SQL conditions,
 * including support for parentheses grouping, AND/OR logic, special colon-based filters, and customizable weight systems
 * using symbolic operators. Designed with modularity and extensibility in mind, it also prevents unwanted repetitions and
 * allows precise control over column names, aliases, and JSON handling through `json_each`.
 *
 * The class includes:
 * - Methods to parse complex string-based filters (`parseString`, `safeParseString`)
 * - Smart logic to detect and manage tag groups, boolean relationships, and custom operators
 * - Support for boost values, exclusions, and other modifiers via symbols (e.g., `-`, `!`)
 * - An internal engine to dynamically build `EXISTS`-based SQL conditions compatible with JSON arrays
 * - Integration-ready output for SQLite3, Postgre or similar relational databases
 *
 * ----------
 * 💖 Special Thanks 💖
 * Deep gratitude to the Derpibooru project for the inspiration, structure, and creativity
 * that influenced this tool. A tiny heartfelt thank you to **Nighty**. :3
 */
class PuddySqlTags {
  /**
   * json_each
   *
   * @type {string|null}
   */
  #jsonEach = 'json_each';

  /** @type {SpecialQuery[]} */
  #specialQueries = [];

  #defaultColumn = '';
  #wildcardA = '*';
  #wildcardB = '?';
  #noRepeat = false;
  #useJsonEach = true;
  #parseLimit = -1;

  /** @type {string|null} */
  #defaultTableName = null;

  /**
   * Creates an instance of the PuddySqlTags class.
   * @param {string} defaultColumn - The default column name to use in queries (default is 'tags').
   */
  constructor(defaultColumn = 'tags') {
    this.setColumnName(defaultColumn);
  }

  /**
   * #tagInputs is a private property that holds predefined mappings for special symbols
   * used to categorize and assign values to specific tag lists. These mappings help in organizing
   * tags based on their associated symbols and their corresponding value keys.
   *
   * - `'^'`: Maps to the 'boosts' list, with the associated value key being 'boost'.
   * - `'~'`: Maps to the 'fuzzies' list, with the associated value key being 'fuzzy'.
   *
   * These mappings enable flexible handling of tags, where the symbols (`^`, `~`, etc.) can be used
   * to categorize tags dynamically and assign values to them based on their symbol.
   *
   * @type {Object<string, TagInput>}
   * @example
   * // Example usage:
   * const symbolMapping = this.#tagInputs['^'];
   * // symbolMapping will be { list: 'boosts', valueKey: 'boost' }
   */
  #tagInputs = {
    '^': { list: 'boosts', valueKey: 'boost' },
    '~': { list: 'fuzzies', valueKey: 'fuzzy' },
  };

  /**
   * Adds a new tag input mapping to the #tagInputs property.
   *
   * This method allows dynamic addition of new tag input mappings by providing a `key`,
   * `list`, and `valueKey`. It validates the types of `list` and `valueKey`, and
   * prevents adding a tag with the list name "include" and "column" as it is restricted.
   *
   * @param {string} key - The key (symbol) to associate with the tag input.
   * @param {string} list - The list name where the tag will be added.
   * @param {string} valueKey - The key for the value associated with the tag input.
   * @throws {Error} Throws an error if `list` or `valueKey` are not strings,
   * or if the `list` name is "include" or "column".
   */
  addTagInput(key, list, valueKey) {
    // Validation to ensure 'list' and 'valueKey' are strings
    if (typeof list !== 'string' || typeof valueKey !== 'string') {
      throw new TypeError('Both list and valueKey must be strings');
    }

    // Prevents adding a tag with the list name "include"
    if (list === 'include') {
      throw new Error('Cannot add a tag with the list name "include"');
    }

    // Prevents adding a tag with the list name "column"
    if (list === 'column') {
      throw new Error('Cannot add a tag with the list name "column"');
    }

    // Adds the new tag input to #tagInputs
    this.#tagInputs[key] = { list, valueKey };
  }

  /**
   * Checks if a tag input mapping exists for the given key.
   *
   * @param {string} key - The tag key to check.
   * @returns {boolean} `true` if the key exists in `#tagInputs`, otherwise `false`.
   * @throws {TypeError} If `key` is not a string.
   */
  hasTagInput(key) {
    if (typeof key !== 'string') throw new TypeError('key must be a string');
    if (this.#tagInputs.hasOwnProperty(key)) return true;
    return false;
  }

  /**
   * Removes a tag input mapping from the `#tagInputs` object.
   *
   * If the key exists, it will be deleted.
   * Otherwise, an error is thrown.
   *
   * @param {string} key - The key of the tag input to remove.
   * @throws {Error} If the specified key does not exist in `#tagInputs`.
   * @throws {TypeError} If `key` is not a string.
   */
  removeTagInput(key) {
    // Check if the key exists in the #tagInputs object
    if (this.hasTagInput(key)) {
      // Delete the tag input if it exists
      delete this.#tagInputs[key];
    }
    throw new Error(`Tag input key '${key}' does not exist.`);
  }

  /**
   * Gets the title of the first item for a given tag input key.
   *
   * @param {string} key - The key of the tag input to retrieve.
   * @returns {TagInput} The title of the first item.
   * @throws {TypeError} If `key` is not a string.
   * @throws {Error} If the key does not exist or has no valid title.
   */
  getTagInput(key) {
    if (typeof key !== 'string') throw new TypeError('Tag input key must be a string');
    if (!this.#tagInputs[key]) throw new Error(`Tag input '${key}' is missing.`);
    return { ...this.#tagInputs[key] };
  }

  /**
   * Gets an array of all tag input titles.
   *
   * @returns {TagInput[]} An array containing the tag inputs.
   */
  getAllTagInput() {
    return Object.entries(this.#tagInputs).map(([key, entry]) => ({ ...entry }));
  }

  /**
   * Sets whether repeated tags are allowed.
   * Internally sets `this.#noRepeat` to the inverse of the boolean value provided.
   * If value is not a boolean, resets `noRepeat` to null.
   *
   * @param {boolean} value - True to allow repeated tags, false to prevent them.
   */
  setCanRepeat(value) {
    if (typeof value !== 'boolean') throw new TypeError('value must be a boolean');
    this.#noRepeat = !value;
  }

  /**
   * Sets the wildcard symbol used in the search expression.
   * Only updates if the value is a string.
   *
   * @param {'wildcardA'|'wildcardB'} where - Which wildcard to set.
   * @param {string|null} value - The wildcard symbol (e.g. '*', '%').
   */
  setWildcard(where, value) {
    if (where !== 'wildcardA' && where !== 'wildcardB')
      throw new Error("where must be 'wildcardA' or 'wildcardB'");
    if (typeof value !== 'string') throw new TypeError('value must be a string');
    if (where === 'wildcardA') this.#wildcardA = value;
    if (where === 'wildcardB') this.#wildcardB = value;
  }

  /**
   * Adds a new custom special query to the internal list.
   * Special queries can affect how tags are interpreted or matched.
   *
   * @param {Object} config - The special query object to be added.
   * @param {string} config.title - The unique title identifier of the special query.
   * @param {(value: string) => string} [config.parser] The special query function to convert the final value.
   */
  addSpecialQuery(config) {
    if (!isJsonObject(config) || typeof config.title !== 'string')
      throw new TypeError('config must be an object with a string "title"');
    this.#specialQueries.push(config);
  }

  /**
   * Checks if a special query with the given title exists.
   *
   * @param {string} title - The title of the special query to check.
   * @returns {boolean} `true` if a special query with the title exists, otherwise `false`.
   * @throws {TypeError} If `title` is not a string.
   */
  hasSpecialQuery(title) {
    if (typeof title !== 'string') throw new TypeError('title must be a string');
    if (this.#specialQueries.findIndex((item) => item.title === title)) return true;
    return false;
  }

  /**
   * Removes a special query identified by its title.
   *
   * If a query with the specified title exists, it is removed.
   * Otherwise, an error is thrown.
   *
   * @param {string} title - The title of the special query to remove.
   * @throws {TypeError} If `title` is not a string.
   * @throws {Error} If no special query with the given title exists.
   */
  removeSpecialQuery(title) {
    if (typeof title !== 'string') throw new TypeError('title must be a string');
    const index = this.#specialQueries.findIndex((item) => item.title === title);
    if (index > -1) {
      this.#specialQueries.splice(index, 1);
      return;
    }
    throw new Error(`Special query with title '${title}' does not exist.`);
  }

  /**
   * Retrieves the title of a special query by its title key.
   *
   * This method checks if a special query with the given title exists
   * and returns its `parser` value. If not found, it throws an error.
   *
   * @param {string} title - The title of the special query to retrieve.
   * @returns {(function(string): string) | null} The function of the found special query.
   * @throws {TypeError} If `title` is not a string.
   * @throws {Error} If no special query with the given title exists.
   */
  getSpecialQuery(title) {
    if (typeof title !== 'string') throw new TypeError('title must be a string');
    const item = this.#specialQueries.find((entry) => entry.title === title);
    if (!item) throw new Error(`No special query found with title '${title}'`);
    return item.parser || null;
  }

  /**
   * Returns a list of all special query titles.
   *
   * This is a shallow extraction of the `title` field from every item
   * in the internal `#specialQueries` array.
   *
   * @returns {string[]} An array of all special query titles.
   */
  getAllSpecialQuery() {
    return this.#specialQueries.map((item) => item.title);
  }

  /**
   * Sets the name of the default SQL column used when building tag-based conditions.
   *
   * @param {string} value - Column name to be used as default (e.g. 'tags').
   */
  setColumnName(value) {
    if (typeof value !== 'string') throw new TypeError('value must be a string');
    this.#defaultColumn = value;
  }

  /**
   * Gets the current default SQL column name used for tag conditions.
   *
   * @returns {string} The name of the default column.
   */
  getColumnName() {
    return this.#defaultColumn;
  }

  /**
   * Sets a limit on the number of items parsed from the search string.
   * Used to avoid overloading the engine with too many conditions.
   *
   * @param {number} value - Maximum number of items to parse (use -1 for no limit).
   */
  setParseLimit(value) {
    if (typeof value !== 'number') throw new TypeError('value must be a number');
    this.#parseLimit = value;
  }

  /**
   * Gets the current limit on how many tags are parsed from a search string.
   *
   * @returns {number} The current parse limit.
   */
  getParseLimit() {
    return this.#parseLimit;
  }

  /**
   * Enables or disables the use of `json_each()` in SQL statements.
   * This affects how JSON-based columns are traversed.
   *
   * @param {boolean} value - Whether to use `json_each()` in tag conditions.
   */
  setUseJsonEach(value) {
    if (typeof value !== 'boolean') throw new TypeError('value must be a boolean');
    this.#useJsonEach = value;
  }

  /**
   * Sets the external table name name used in `EXISTS` subqueries, typically referencing `value`.
   *
   * @param {string} value - The alias to use in SQL subqueries (e.g. 'value').
   */
  setTableName(value) {
    if (typeof value !== 'string') throw new TypeError('value must be a string');
    this.#defaultTableName = value;
  }

  /**
   * Sets the raw SQL string used for the `json_each()` expression.
   * This is used for custom SQL generation.
   *
   * @param {string} value - The SQL snippet (e.g. "json_each(tags)").
   */
  setJsonEach(value) {
    if (value !== null && typeof value !== 'string') throw new TypeError('value must be a string');
    this.#jsonEach = value;
  }

  #isPgMode = false;

  /**
   * Sets whether the engine is running in PostgreSQL mode.
   *
   * @param {boolean} value - Must be a boolean true/false.
   * @throws {TypeError} If the value is not a boolean.
   */
  setIsPgMode(value) {
    if (typeof value !== 'boolean') {
      throw new TypeError(`setIsPgMode() expects a boolean, but received: ${typeof value}`);
    }
    this.#isPgMode = value;
  }

  /**
   * Gets whether the engine is currently in PostgreSQL mode.
   *
   * @returns {boolean}
   */
  getIsPgMode() {
    return this.#isPgMode;
  }

  /**
   * Builds an SQL WHERE clause from a structured tag group definition.
   *
   * This method supports both direct equality and wildcard matching using custom
   * wildcard symbols (`wildcardA`, `wildcardB`). Tags can be negated with a leading `!`.
   * It generates nested `EXISTS` or `NOT EXISTS` subqueries depending on the `useJsonEach` flag.
   *
   * The method returns a string representing the SQL WHERE clause, and updates `pCache.values`
   * with the filtered values in proper order for parameterized queries.
   *
   * @param {Pcache} [pCache={ index: 1, values: [] }] - Placeholder cache object.
   * @param {TagCriteria} [group={}] - Tag group definition to build the clause from.
   *
   * @returns {string} The generated SQL condition string (e.g., `(EXISTS (...)) AND (NOT EXISTS (...))`).
   */
  parseWhere(group = {}, pCache = { index: 1, values: [] }) {
    if (!isJsonObject(pCache))
      throw new TypeError(`Expected pCache to be a valid object, but got ${typeof pCache}`);
    if (!isJsonObject(group))
      throw new TypeError(`Expected group to be a valid object, but got ${typeof group}`);
    if (typeof pCache.index !== 'number')
      throw new TypeError(
        `Invalid or missing pCache.index; expected number but got ${typeof pCache.index}`,
      );
    if (!Array.isArray(pCache.values))
      throw new TypeError(
        `Invalid or missing pCache.values; expected array but got ${typeof pCache.values}`,
      );

    const where = [];
    const tagsColumn = group.column || this.getColumnName();
    const tagsTable = group.tableName || this.#defaultTableName;
    const allowWildcards = typeof group.allowWildcards === 'boolean' ? group.allowWildcards : false;

    if (!Array.isArray(group.include))
      throw new TypeError(
        `Expected 'include' to be an array of tags or tag groups, but got ${typeof group.include}`,
      );
    const include = group.include;

    /**
     * Generates a subquery for checking tag inclusion/exclusion.
     *
     * @param {boolean} not - Whether the condition is a negation (NOT).
     * @param {string} param - The parameter placeholder (e.g., `$1`, `$2`, etc.).
     * @param {boolean} [useLike=false] - Whether to use `LIKE` instead of `=`.
     * @returns {string} The SQL snippet for the tag existence check.
     * @throws {Error} If SQLite mode is active and `tagsTable` is not defined.
     */
    const createQuery = (not, param, useLike = false) => {
      // Sqlite3
      if (!this.#isPgMode) {
        let result;
        if (this.#useJsonEach) {
          result = `${this.#jsonEach}(${tagsColumn}) WHERE value ${useLike ? 'LIKE' : '='} ${param}`;
        } else {
          if (typeof tagsTable !== 'string' || tagsTable.trim() === '') {
            throw new Error(
              `Missing or invalid 'tagsTable'. Expected a non-empty string when using SQLite mode without json_each.`,
            );
          }
          result = `${tagsColumn} WHERE ${tagsTable}.${tagsColumn} ${useLike ? 'LIKE' : '='} ${param}`;
        }

        return `${not ? 'NOT ' : ''}EXISTS (SELECT 1 FROM ${result})`;
      }
      // PostgreSQL
      else {
        return `${not ? 'NOT (' : ''}${param} = ANY(${tagsColumn})${not ? ')' : ''}`;
      }
    };

    /**
     * @param {string} tag
     * @returns {{ param: string; usesWildcard: boolean; not: boolean; }}
     */
    const filterTag = (tag) => {
      if (typeof tag !== 'string')
        throw new TypeError(`Each tag must be a string, but received: ${typeof tag}`);

      const not = tag.startsWith('!');
      const cleanTag = not ? tag.slice(1) : tag;
      // if (!cleanTag) throw new SyntaxError('Empty tag name after negation (!tag)');

      if (typeof pCache.index !== 'number') throw new Error('Invalid pCache index');
      const param = `$${pCache.index++}`;

      const usesWildcard =
        allowWildcards &&
        (cleanTag.includes(this.#wildcardA) || cleanTag.includes(this.#wildcardB));
      const filteredTag = usesWildcard
        ? cleanTag
            .replace(/([%_])/g, '\\$1')
            .replaceAll(this.#wildcardA, '%')
            .replaceAll(this.#wildcardB, '_')
        : cleanTag;

      if (!Array.isArray(pCache.values)) throw new Error('Invalid pCache values');
      pCache.values.push(filteredTag);
      return { param, usesWildcard, not };
    };

    for (const clause of include) {
      if (Array.isArray(clause)) {
        // if (!clause.length) throw new SyntaxError('Empty OR group inside "include" array');
        const ors = clause.map((tag) => {
          const { param, usesWildcard, not } = filterTag(tag);
          return createQuery(not, param, usesWildcard);
        });
        if (ors.length) where.push(`(${ors.join(' OR ')})`);
      } else {
        const { param, usesWildcard, not } = filterTag(clause);
        where.push(createQuery(not, param, usesWildcard));
      }
    }

    // Only AND between the conditions generated
    return where.length ? `(${where.join(' AND ')})` : '1';
  }

  /**
   * Builds an SQL WHERE clause for "flat" tag tables (one tag per row).
   *
   * Works like parseWhere, but does NOT use EXISTS/json_each.
   * Filters rows by direct equality or LIKE, supports negation (!tag),
   * wildcards, OR/AND groups, and updates pCache for parameterized queries.
   *
   * @param {TagCriteria} [group={}] - Tag group definition
   * @param {Pcache} [pCache={ index: 1, values: [] }] - Placeholder cache object
   * @returns {string} SQL WHERE clause string
   */
  parseWhereFlat(group = {}, pCache = { index: 1, values: [] }) {
    if (!isJsonObject(pCache))
      throw new TypeError(`Expected pCache to be a valid object, but got ${typeof pCache}`);
    if (!isJsonObject(group))
      throw new TypeError(`Expected group to be a valid object, but got ${typeof group}`);
    if (typeof pCache.index !== 'number')
      throw new TypeError(`Invalid or missing pCache.index; expected number`);
    if (!Array.isArray(pCache.values))
      throw new TypeError(`Invalid or missing pCache.values; expected array`);

    const where = [];
    const tagsColumn = group.column || 'tag';
    const allowWildcards = typeof group.allowWildcards === 'boolean' ? group.allowWildcards : false;
    const include = Array.isArray(group.include) ? group.include : [];

    /**
     * @param {string} tag
     * @returns {{ param: string; usesWildcard: boolean; not: boolean; }}
     */
    const filterTag = (tag) => {
      if (typeof tag !== 'string')
        throw new TypeError(`Each tag must be a string, but received: ${typeof tag}`);

      const not = tag.startsWith('!');
      const cleanTag = not ? tag.slice(1) : tag;

      if (typeof pCache.index !== 'number') throw new Error('Invalid pCache index');
      const param = `$${pCache.index++}`;

      const usesWildcard =
        allowWildcards &&
        (cleanTag.includes(this.#wildcardA) || cleanTag.includes(this.#wildcardB));

      const filteredTag = usesWildcard
        ? cleanTag
            .replace(/([%_])/g, '\\$1')
            .replaceAll(this.#wildcardA, '%')
            .replaceAll(this.#wildcardB, '_')
        : cleanTag;

      if (!Array.isArray(pCache.values)) throw new Error('Invalid pCache values');
      pCache.values.push(filteredTag);
      return { param, usesWildcard, not };
    };

    /** @param {{ param: string; usesWildcard: boolean; not: boolean; }} tagObj */
    const createQuery = (tagObj) => {
      const { param, usesWildcard, not } = tagObj;
      const operator = usesWildcard ? 'LIKE' : '=';
      return `${tagsColumn} ${not ? '!=' : operator} ${param}`;
    };

    for (const clause of include) {
      if (Array.isArray(clause)) {
        // OR group
        const ors = clause.map((tag) => createQuery(filterTag(tag)));
        if (ors.length) where.push(`(${ors.join(' OR ')})`);
      } else {
        // single tag
        where.push(createQuery(filterTag(clause)));
      }
    }

    // Combine all with AND
    return where.length ? `(${where.join(' AND ')})` : '1';
  }

  /**
   * Extracts special query elements and custom tag input groups from parsed search chunks.
   *
   * This method processes a list of parsed string chunks (which may contain modifiers, values,
   * or special keywords) and extracts custom input values and predefined special queries.
   *
   * It uses the configured `#tagInputs` to detect symbol-based values (e.g. score+3, weight*2),
   * and `#specialQueries` to detect and parse keys like `source:ponybooru`.
   *
   * It also updates the input chunks to remove already-processed terms and eliminate repetitions
   * when `noRepeat` mode is enabled.
   *
   * @param {Chunks} chunks - A list of search terms or OR-groups (e.g., ['pony', ['red', 'blue']]).
   *
   * @returns {{ specials: SpecialFromChunks[] }} An object with:
   *   - `specials`: An array of extracted special queries `{ key, value }`.
   *   - one property for each defined group in `#tagInputs`, each holding an array of objects with extracted values.
   *     Example: `{ boosts: [{ term: "pony", boost: 2 }], specials: [...] }`
   */
  #extractSpecialsFromChunks(chunks) {
    /** @type {SpecialFromChunks[]} */
    const specials = [];

    /** @type {Record<string, { term: string; }[]>} */
    const outputGroups = {}; // Will store the dynamic groups
    /** @type {Record<string, Set<string>>} */
    const uniqueMap = {}; // Will store the dynamic sets

    // Initiating sets for each group set in #tagInputs
    for (const symbol in this.#tagInputs) {
      const { list } = this.#tagInputs[symbol];
      outputGroups[list] = [];
      uniqueMap[list] = new Set();
    }

    const uniqueTags = new Set();

    for (let i = chunks.length - 1; i >= 0; i--) {
      const group = chunks[i];
      const terms = Array.isArray(group) ? group : [group];
      const remainingTerms = [];

      for (const term of terms) {
        let matched = false;

        // Checking if the term contains any of the symbols set in #tagInputs
        for (const symbol in this.#tagInputs) {
          if (term.includes(symbol)) {
            const { list, valueKey } = this.#tagInputs[symbol];
            const [termValue, rawValue] = term.split(symbol);
            let value = parseFloat(rawValue.replace(/\!/g, '-'));
            if (Number.isNaN(value)) value = 1;

            // Adds the value to the respective group if it has not yet been processed
            if (!uniqueMap[list].has(termValue.trim())) {
              outputGroups[list].push({ term: termValue.trim(), [valueKey]: value });
              uniqueMap[list].add(termValue.trim());
            }

            // Checking if the term has already been added in the unique tag set
            if (!this.#noRepeat || Array.isArray(group) || !uniqueTags.has(termValue.trim())) {
              remainingTerms.push(termValue.trim());
              if (!Array.isArray(group)) uniqueTags.add(termValue.trim());
            }

            matched = true;
            break; // For verification after the first corresponding symbol
          }
        }

        if (matched) continue;

        // Specials with ":"
        if (term.includes(':')) {
          const [key, ...rest] = term.split(':');
          const value = rest.join(':');
          const found = this.#specialQueries.find((q) => q.title === key);

          if (found && value !== undefined) {
            let parsedValue = value;
            if (typeof found.parser === 'function') parsedValue = found.parser(value);
            specials.push({ key, value: parsedValue });
          } else {
            remainingTerms.push(term);
          }
        } else {
          // If it is not a special term, it usually treats or allows repetition within groups
          if (!this.#noRepeat || Array.isArray(group) || !uniqueTags.has(term)) {
            remainingTerms.push(term);
            if (!Array.isArray(group)) uniqueTags.add(term);
          }
        }
      }

      // If no terms remain, remove the group
      if (remainingTerms.length === 0) {
        chunks.splice(i, 1);
      } else {
        chunks[i] = Array.isArray(group) ? remainingTerms : remainingTerms[0];
      }
    }

    // Returns all dynamically generated groups
    return {
      specials,
      ...outputGroups,
    };
  }

  /**
   * Parses a search input string into structured query components.
   *
   * This method tokenizes the input string based on grouping (parentheses), logical
   * operators (`AND`, `OR`), and quoting (single or double). It supports optional
   * repetition control (`noRepeat`) and a configurable tag limit (`parseLimit`).
   *
   * The output is normalized into an `include` list of tags or OR-groups (arrays),
   * as well as dynamic sets of extracted metadata like `boosts`, `specials`, etc.
   *
   * This parser supports expressions like:
   *   `applejack^2, "rainbow dash", (solo OR duo), pudding AND source:ponybooru`
   *
   * @param {string} input - The raw input string provided by the user.
   * @param {boolean} [strictMode=false] - Enables strict validation checks.
   * @param {Object} [strictConfig={}] - Optional validation rules for strict mode:
   *   @param {boolean} [strictConfig.emptyInput=true] - Throw if input is empty after trimming.
   *   @param {boolean} [strictConfig.parseLimit=true] - Enforce the parse limit (`this.parseLimit`).
   *   @param {boolean} [strictConfig.openParens=true] - Require balanced parentheses.
   *   @param {boolean} [strictConfig.quoteChar=true] - Require closing quotes if one is opened.
   *
   * @returns {ParseStringResult} An object containing:
   *   - `column`: The column name from `this.getColumnName()`.
   *   - `include`: Array of tags and OR-groups to include in the query.
   *   - Additional properties (e.g., `boosts`, `specials`) depending on matches in `#tagInputs` or `#specialQueries`.
   *
   * Example return:
   * ```js
   * {
   *   column: 'tags',
   *   include: ['applejack', ['solo', 'duo'], 'pudding'],
   *   boosts: [{ term: 'applejack', boost: 2 }],
   *   specials: [{ key: 'source', value: 'ponybooru' }]
   * }
   * ```
   */
  parseString(input, strictMode = false, strictConfig = {}) {
    if (typeof input !== 'string') {
      throw new TypeError(`Expected input to be a string, but received ${typeof input}`);
    }

    const strictCfg = _.defaults(strictConfig, {
      emptyInput: true,
      parseLimit: true,
      openParens: true,
      quoteChar: true,
    });

    input = input.replace(/\s+/g, ' ').trim();
    if (strictMode && strictCfg.emptyInput && !input.length) {
      throw new Error('Input string is empty after trimming');
    }

    /** @type {Chunks} */
    const chunks = [];

    /** @type {string[]} */
    let currentGroup = [];

    let buffer = '';
    let inQuotes = false;
    let quoteChar = '';
    const uniqueTags = new Set(); // Para garantir que não existam tags duplicadas
    let inGroup = false;
    let openParens = 0;
    let tagCount = 0;

    const flushBuffer = () => {
      const value = buffer.trim();
      if (!value) return;
      if (this.#parseLimit < 0 || tagCount < this.#parseLimit) {
        if (!this.#noRepeat || inGroup || !uniqueTags.has(value)) {
          currentGroup.push(value);
          if (!inGroup) uniqueTags.add(value);
          tagCount++;
        }
      } else if (strictMode && strictCfg.parseLimit) {
        throw new Error(`Exceeded tag parse limit of ${this.#parseLimit}`);
      }
      buffer = '';
    };

    const flushGroup = () => {
      if (currentGroup.length === 1) {
        chunks.push(currentGroup[0]);
      } else if (currentGroup.length > 1) {
        chunks.push([...currentGroup]);
      }
      currentGroup = [];
    };

    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      const next4 = input.slice(i, i + 4).toUpperCase();
      const next3 = input.slice(i, i + 3).toUpperCase();

      if (inQuotes) {
        if (c === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        } else {
          buffer += c;
        }
        continue;
      }

      if (c === '"' || c === "'") {
        inQuotes = true;
        quoteChar = c;
        continue;
      }

      if (c === '(') {
        openParens++;
        flushBuffer();
        currentGroup = [];
        inGroup = true;
        continue;
      }

      if (c === ')') {
        if (strictMode && strictCfg.openParens && openParens <= 0) {
          throw new SyntaxError(`Unexpected closing parenthesis at position ${i}`);
        }
        openParens--;
        flushBuffer();
        flushGroup();
        inGroup = false;
        continue;
      }

      if (next4 === ' AND') {
        flushBuffer();
        flushGroup();
        i += 3;
        continue;
      }

      if (next3 === 'OR ') {
        flushBuffer();
        i += 2;
        continue;
      }

      buffer += c;
    }

    if (strictMode) {
      if (strictCfg.quoteChar && inQuotes)
        throw new SyntaxError(`Unclosed quote starting with ${quoteChar}`);
      if (strictCfg.openParens && openParens > 0)
        throw new SyntaxError(`Unclosed parenthesis — ${openParens} more ')' expected`);
    }

    flushBuffer();
    flushGroup();

    const outputGroups = this.#extractSpecialsFromChunks(chunks);
    return { column: this.getColumnName(), include: chunks, ...outputGroups };
  }

  /**
   * Sanitizes and normalizes a raw input string before parsing.
   *
   * This method prepares user input for parsing by replacing common symbolic
   * boolean operators (`&&`, `||`, `-`, `NOT`) with their textual equivalents
   * (`AND`, `OR`, `!`). It also trims whitespace and replaces commas with `AND`
   * to enforce consistent logical separation.
   *
   * This is useful when parsing user input that might come from flexible or
   * user-friendly interfaces where symbols are more commonly used than
   * structured boolean expressions.
   *
   * @param {string} input - The raw input string provided by the user.
   * @param {boolean} [strictMode=false] - Enables strict validation checks.
   * @param {Object} [strictConfig={}] - Optional validation rules for strict mode:
   *   @param {boolean} [strictConfig.emptyInput=true] - Throw if input is empty after trimming.
   *   @param {boolean} [strictConfig.parseLimit=true] - Enforce the parse limit (`this.parseLimit`).
   *   @param {boolean} [strictConfig.openParens=true] - Require balanced parentheses.
   *   @param {boolean} [strictConfig.quoteChar=true] - Require closing quotes if one is opened.
   *
   * @returns {ParseStringResult} A structured result object returned by `parseString()`,
   *   containing keys like `column`, `include`, `specials`, `boosts`, etc., depending on
   *   the tags and expressions detected.
   *
   * @example
   * safeParseString("applejack, -source, rarity || twilight")
   * // → equivalent to: parseString("applejack AND !source AND rarity OR twilight")
   */
  safeParseString(input, strictMode = false, strictConfig = {}) {
    return this.parseString(
      input
        .split(',')
        .map((item) => item.trim())
        .join(' AND ')
        .replace(/(?:^|[\s(,])-(?=\w)/g, (match) => match.replace('-', '!'))
        .replace(/\s*\bNOT\b\s*/g, '!')
        .replace(/\&\&/g, 'AND')
        .replace(/\|\|/g, 'OR'),
      strictMode,
      strictConfig,
    );
  }
}

export default PuddySqlTags;
