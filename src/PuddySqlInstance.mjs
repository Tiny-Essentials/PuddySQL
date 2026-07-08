import { open, Database } from 'sqlite';

import { isJsonObject } from './tiny-modules/basics/objChecker.mjs';
import { validatePostgresParams } from './Utils.mjs';
import { pg, sqlite3 } from './Modules.mjs';
import PuddySqlEngine from './PuddySqlEngine.mjs';
import PuddySqlQuery from './PuddySqlQuery.mjs';
import PuddySqlEvents from './PuddySqlEvents.mjs';

/** @typedef {import('pg').Pool} PgPool */
/** @typedef {import('sqlite').Database} SqliteDb */

/**
 * PuddySql is a wrapper for basic SQL operations on a local storage abstraction.
 * It supports inserting, updating, deleting, querying and joining JSON-based structured data.
 */
class PuddySqlInstance extends PuddySqlEngine {
  constructor() {
    super();
  }

  /** @typedef {import('./PuddySqlQuery.mjs').TableSettings} TableSettings */
  /** @typedef {import('./PuddySqlQuery.mjs').SqlTableConfig} SqlTableConfig */

  // @ts-ignore
  #db;

  /** @type {Record<string, PuddySqlQuery>} */
  #tables = {};
  #debug = false;
  #debugCount = 0;
  #consoleColors = true;

  /**
   * Enables or disables console color output for debug messages.
   *
   * @param {boolean} state - Set to `true` to enable colors, or `false` to disable.
   */
  setConsoleColors(state) {
    if (typeof state !== 'boolean') throw new TypeError('state must be a boolean');
    this.#consoleColors = state;
  }

  /**
   * Returns whether console color output is currently enabled.
   *
   * @returns {boolean}
   */
  getConsoleColors() {
    return this.#consoleColors === true;
  }

  /**
   * Formats SQL for colorful and readable debug in terminal.
   * Adds indentation, line breaks, and ANSI colors to major SQL clauses.
   *
   * @param {string} value - Raw SQL query string.
   * @returns {string} Colorized and formatted SQL string for terminal.
   */
  #debugSql(value) {
    if (typeof value !== 'string' || value.trim() === '')
      throw new TypeError('value must be a non-empty string');

    const useColor = this.#consoleColors !== false;

    const RESET = useColor ? '\x1b[0m' : '';
    const WHITE = useColor ? '\x1b[37m' : '';
    const BLUE = useColor ? '\x1b[34m' : '';
    const MAGENTA = useColor ? '\x1b[35m' : '';
    const YELLOW = useColor ? '\x1b[33m' : '';

    const keywords = [
      'WITH',
      'SELECT',
      'FROM',
      'LEFT JOIN',
      'RIGHT JOIN',
      'FULL JOIN',
      'INNER JOIN',
      'CROSS JOIN',
      'JOIN',
      'ON',
      'WHERE',
      'GROUP BY',
      'ORDER BY',
      'HAVING',
      'LIMIT',
      'OFFSET',
      'INSERT INTO',
      'VALUES',
      'UPDATE',
      'SET',
      'DELETE FROM',
      'DELETE',
      'CREATE TABLE',
      'CREATE',
      'DROP TABLE',
      'DROP',
      'ALTER TABLE',
      'ALTER',
      'UNION',
      'EXCEPT',
      'INTERSECT',
      'DISTINCT',
    ];

    // Sort to prevent short words from replacing the long ones first (e.g. DROP before DROP TABLE)
    keywords.sort((a, b) => b.length - a.length);

    // Line breaks before key keywords
    let formatted = value
      .trim()
      .replace(/\s+/g, ' ') // collapses multiple spaces
      .replace(new RegExp(`\\s*(${keywords.join('|')})\\s+`, 'gi'), '\n$1 ') // breaks before the keywords
      .replace(/,\s*/g, ', ') // well formatted commas
      .replace(/\n/g, '\n  '); // indentation

    // Color all keywords
    for (const word of keywords) {
      const regex = new RegExp(`(\\b${word.replace(/\s+/g, '\\s+')}\\b)`, 'gi');
      formatted = formatted.replace(regex, `${YELLOW}$1${WHITE}`);
    }

    // Remove external breaks and apply colored edge
    return (
      `${BLUE}┌─[${MAGENTA}DEBUG SQL${BLUE}]───────────────────────────────────────────────${RESET}\n` +
      `  ${WHITE}${formatted.trim()}\n` +
      `${BLUE}└────────────────────────────────────────────────────────────${RESET}`
    );
  }

  /**
   * Public wrapper for #debugSql().
   * Formats a SQL query using styled indentation and ANSI colors for terminal output.
   *
   * @param {string} value - The raw SQL query string to be formatted.
   * @returns {string} Formatted and colorized SQL for terminal display.
   */
  debugSql(value) {
    return this.#debugSql(value);
  }

  /**
   * Formats a debug message string with colored ANSI tags for the console.
   * Useful for consistent and readable debug logging with identifiers.
   *
   * @param {string|number} id - Identifier used in the SQL tag (e.g., query ID).
   * @param {string} [debugName] - Optional label or context name for the debug log.
   * @param {string} [status] - Optional status message (e.g., 'OK', 'ERROR', 'LOADING').
   * @returns {string} - Formatted string with ANSI color codes for console output.
   *
   * Example output:
   * [SQL][123] [DEBUG] [MyDebug] [OK]
   */
  #debugConsoleText(id, debugName = '', status = '') {
    if (typeof id !== 'string' && typeof id !== 'number')
      throw new TypeError('id must be a string or number');
    if (typeof debugName !== 'string')
      throw new TypeError('debugName must be a string if provided');
    if (typeof status !== 'string') throw new TypeError('status must be a string if provided');
    const useColor = this.#consoleColors !== false;

    const reset = useColor ? '\x1b[0m' : '';
    const gray = useColor ? '\x1b[90m' : '';
    const blue = useColor ? '\x1b[34m' : '';
    const green = useColor ? '\x1b[32m' : '';
    const cyan = useColor ? '\x1b[36m' : '';

    const tagSQL = `${gray}[${blue}SQL${gray}]${gray}[${blue}${id}${gray}]`;
    const tagDebug = `${gray}[${green}DEBUG${gray}]`;
    const tagName = debugName.length > 0 ? ` ${gray}[${cyan}${debugName}${gray}]` : '';
    const tagStatus = status.length > 0 ? ` ${gray}[${status}${gray}]` : '';

    return `${tagSQL} ${tagDebug}${tagName}${tagStatus}${reset}`;
  }

  /**
   * Public wrapper for the internal debug message formatter.
   * Returns a formatted debug string with consistent styling.
   *
   * @param {string|number} id - Identifier used in the SQL tag (e.g., query ID).
   * @param {string} [debugName] - Optional label or context name for the debug log.
   * @param {string} [status] - Optional status message (e.g., 'OK', 'ERROR', 'LOADING').
   * @returns {string} - ANSI-colored debug string for console output.
   */
  debugConsoleText(id, debugName, status) {
    return this.#debugConsoleText(id, debugName, status);
  }

  /**
   * Enables or disables debug mode.
   *
   * When debug mode is enabled, SQL queries and additional debug info will be logged to the console.
   *
   * @param {boolean} isDebug - If true, debug mode is enabled; otherwise, it's disabled.
   */
  setIsDebug(isDebug) {
    if (typeof isDebug !== 'boolean') throw new TypeError('isDebug must be a boolean');
    this.#debug = isDebug;
  }

  /**
   * Checks whether debug mode is currently enabled.
   *
   * @returns {boolean} True if debug mode is enabled; otherwise, false.
   */
  isDebug() {
    return this.#debug;
  }

  /**
   * Initializes a new table.
   *
   * This method checks if a table with the provided name already exists in the internal `#tables` object.
   * If the table doesn't exist, it creates a new instance of the `PuddySqlQuery` submodule, sets the database
   * and settings, and creates the table using the provided column data. The table is then stored in the
   * `#tables` object for future reference.
   *
   * The table name and column data are passed into the `PuddySqlQuery` submodule to construct the table schema.
   * Additional settings can be provided to customize the behavior of the table (e.g., `select`, `order`, `id`).
   *
   * @param {TableSettings} [settings={}] - Optional settings to customize the table creation. This can include properties like `select`, `join`, `order`, `id`, etc.
   * @param {SqlTableConfig} [tableData=[]] - An array of columns and their definitions to create the table. Each column is defined by an array, which can include column name, type, and additional settings.
   * @returns {Promise<PuddySqlQuery>} Resolves to the `PuddySqlQuery` instance associated with the created or existing table.
   * @throws {Error} If the table has already been initialized.
   */
  async initTable(settings = {}, tableData = []) {
    if (!isJsonObject(settings)) throw new TypeError('settings must be a plain object');
    if (typeof settings.name !== 'string') throw new TypeError('settings.name must be a string');
    if (!this.#tables[settings.name]) {
      const newTable = new PuddySqlQuery();
      newTable.setDb(settings, this);
      await newTable.createTable(tableData);

      this.#tables[settings.name] = newTable;
      return this.#tables[settings.name];
    }
    throw new Error('This table has already been initialized');
  }

  /**
   * Retrieves the `PuddySqlQuery` instance for the given table name.
   *
   * This method checks the internal `#tables` object and returns the corresponding `PuddySqlQuery`
   * instance associated with the table name. If the table does not exist, it returns `null`.
   *
   * @param {string} tableName - The name of the table to retrieve.
   * @returns {PuddySqlQuery} The `PuddySqlQuery` instance associated with the table, or `null` if the table does not exist.
   */
  getTable(tableName) {
    if (typeof tableName !== 'string' || tableName.trim() === '')
      throw new TypeError('tableName must be a non-empty string');
    const table = this.#tables[tableName];
    if (!table) throw new Error(`Table "${tableName}" does not exist`);
    return table;
  }

  /**
   * Checks if a table with the given name exists.
   *
   * This method checks if the table with the specified name has been initialized in the internal
   * `#tables` object and returns a boolean value indicating its existence.
   *
   * @param {string} tableName - The name of the table to check.
   * @returns {boolean} `true` if the table exists, `false` if it does not.
   */
  hasTable(tableName) {
    return this.getTable(tableName) ? true : false;
  }

  /**
   * Removes the table with the given name from the internal table collection.
   *
   * This method deletes the table instance from the `#tables` object, effectively removing it from
   * the internal management of tables. It returns `true` if the table was successfully removed,
   * or `false` if the table does not exist.
   *
   * @param {string} tableName - The name of the table to remove.
   */
  removeTable(tableName) {
    if (typeof tableName !== 'string' || tableName.trim() === '')
      throw new TypeError('tableName must be a non-empty string');
    if (!this.#tables[tableName])
      throw new Error(`Table "${tableName}" does not exist and cannot be removed`);
    delete this.#tables[tableName];
  }

  /**
   * Drops and removes the table with the given name.
   *
   * This method calls the `dropTable()` method on the corresponding `PuddySqlQuery` instance,
   * removing the table schema from the database. After successfully dropping the table, it removes
   * the table from the internal `#tables` object.
   *
   * @param {string} tableName - The name of the table to drop.
   */
  async dropTable(tableName) {
    if (typeof tableName !== 'string' || tableName.trim() === '')
      throw new TypeError('tableName must be a non-empty string');
    const table = this.#tables[tableName];
    if (!table) throw new Error(`Table "${tableName}" does not exist and cannot be dropped`);
    await table.dropTable();
    this.removeTable(tableName);
  }

  /**
   * Returns the raw database instance currently in use.
   *
   * This gives direct access to the internal database connection (PostgreSQL `Pool` or SQLite3 `Database`),
   * which can be useful for advanced queries or database-specific operations not covered by this wrapper.
   *
   * @returns {SqliteDb|PgPool} The internal database instance, or `null` if not initialized.
   */
  getDb() {
    if (!this.#db) throw new Error('Database instance is not initialized');
    return this.#db;
  }

  /**
   * A method to check if the database connection is open.
   *
   * This method attempts to run a simple query on the database to determine if the
   * connection is open or closed. It returns `true` if the database is open and
   * `false` if the database is closed.
   *
   * @function
   * @returns {Promise<boolean>} A promise that resolves to `true` if the database is open, `false` otherwise.
   */
  async isDbOpen() {
    try {
      await this.get('SELECT 1');
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Initializes an SQLite3 >= 3.35.0 database connection and sets up the SQL engine for this instance.
   *
   * This method creates a new SQLite3 database using the specified file path (or in-memory by default),
   * assigns the SQL engine behavior using `setSqlite3()`, and sets up a `SIGINT` listener to ensure
   * the database is properly closed when the process is interrupted.
   *
   * @param {string} [filePath=':memory:'] - Path to the SQLite3 database file. Defaults to in-memory.
   * @returns {Promise<void>} Resolves when the database is ready and the engine is set.
   * @throws {Error} If a SQL engine has already been initialized for this instance.
   */
  async initSqlite3(filePath = ':memory:') {
    if (this.isSqlEngineEmpty()) {
      /** @type {SqliteDb} */
      this.#db = await open({
        filename: filePath,
        driver: sqlite3.Database,
      });

      // Set SQL methods (all, get, run)
      this.setSqlite3(this.#db);
    } else throw new Error('SQL has already been initialized in this instance!');
  }

  /**
   * Initializes SQLite3-specific SQL methods on this instance using the provided database wrapper.
   *
   * This method sets the SQL engine to "sqlite3" and defines the `all`, `get`, and `run` methods.
   * These methods internally wrap around the provided `db` object's asynchronous methods (`all`, `get`, `run`),
   * returning promises that resolve with the expected results or `null` on invalid data.
   *
   * @param {SqliteDb} db - A SQLite3 database wrapper that exposes `all`, `get`, and `run` methods returning Promises.
   * @throws {Error} If a SQL engine has already been set for this instance.
   */
  setSqlite3(db) {
    if (!(db instanceof Database)) throw new Error('Invalid type for db. Expected a Sqlite3.');
    if (this.isSqlEngineEmpty()) {
      this.setSqlEngine('sqlite3');

      /**
       * Checks if the given error is a connection error.
       *
       * @param {any} err - The error object to evaluate.
       * @returns {boolean} Returns true if the error is a connection error.
       */
      const isConnectionError = (err) => this.isConnectionError(err);

      /**
       * Emits a 'connection-error' event if the error is related to connection issues.
       *
       * @param {any} err - The error object to check and possibly emit.
       * @param {function} reject
       * @returns {void}
       */
      const rejectConnection = (reject, err) => {
        if (isConnectionError(err)) this.emit(PuddySqlEvents.ConnectionError, err);
        reject(err);
      };
      const getId = () => this.#debugCount++;
      const isDebug = () => this.#debug;

      /**
       * Sends SQL debug information to the console, including query and parameters.
       *
       * @param {number} id - The debug operation ID.
       * @param {string} debugName - An optional label to identify the debug context.
       * @param {string} query - The SQL query being executed.
       * @param {any[]} params - The parameters passed to the query.
       * @returns {void}
       */
      const sendSqlDebug = (id, debugName, query, params) => {
        if (isDebug()) {
          console.log(this.#debugConsoleText(id, debugName), params);
          console.log(this.#debugSql(query));
        }
      };

      /**
       * Sends SQL result debug information to the console.
       *
       * @param {number} id - The debug operation ID.
       * @param {string} debugName - An optional label to identify the debug context.
       * @param {string} type - Optional descriptor of the operation type.
       * @param {any} data - The result data to output.
       * @returns {void}
       */
      const sendSqlDebugResult = (id, debugName, type, data) => {
        if (isDebug())
          console.log(
            this.#debugConsoleText(id, debugName, type),
            typeof data !== 'undefined' &&
              data !== null &&
              (!Array.isArray(data) || data.length > 0)
              ? data
              : 'Success!',
          );
      };

      /**
       * Executes a query expected to return multiple rows.
       *
       * @param {string} query - The SQL query to execute.
       * @param {any[*]} [params=[]] - Optional query parameters.
       * @returns {Promise<Array<Object>|null>} Resolves with an array of result rows or null if invalid.
       */
      this.all = async function (query, params = [], debugName = '') {
        return new Promise((resolve, reject) => {
          validatePostgresParams(query, params, reject);
          const id = getId();
          sendSqlDebug(id, debugName, query, params);
          db.all(query, params)
            .then((result) => {
              sendSqlDebugResult(id, debugName, '', result);
              resolve(Array.isArray(result) ? result : null);
            })
            .catch((err) => rejectConnection(reject, err));
        });
      };

      /**
       * Executes a query expected to return a single row.
       *
       * @param {string} query - The SQL query to execute.
       * @param {any[*]} [params=[]] - Optional query parameters.
       * @returns {Promise<Record<any, any>|null>} Resolves with the result row or null if not a valid object.
       */
      this.get = async function (query, params = [], debugName = '') {
        return new Promise((resolve, reject) => {
          validatePostgresParams(query, params, reject);
          const id = getId();
          sendSqlDebug(id, debugName, query, params);
          db.get(query, params)
            .then((result) => {
              sendSqlDebugResult(id, debugName, '', result);
              resolve(isJsonObject(result) ? result : null);
            })
            .catch((err) => rejectConnection(reject, err));
        });
      };

      /**
       * Executes a query that modifies the database (e.g., INSERT, UPDATE, DELETE).
       *
       * @param {string} query - The SQL query to execute.
       * @param {any[*]} params - Query parameters.
       * @returns {Promise<Record<any, any>|null>} Resolves with the result object or null if invalid.
       */
      this.run = async function (query, params, debugName = '') {
        return new Promise((resolve, reject) => {
          validatePostgresParams(query, params, reject);
          const id = getId();
          sendSqlDebug(id, debugName, query, params);
          db.run(query, params)
            .then((result) => {
              sendSqlDebugResult(id, debugName, '', result);
              resolve(isJsonObject(result) ? result : null);
            })
            .catch((err) => rejectConnection(reject, err));
        });
      };
    } else throw new Error('SQL has already been initialized in this instance!');
  }

  /**
   * Initializes a PostgreSQL client and sets up the SQL engine for this instance.
   *
   * This method creates a new PostgreSQL `Pool` using the given configuration,
   * connects to the database, and assigns the SQL engine behavior using `setPostgre()`.
   * It also attaches a `SIGINT` listener to gracefully close the database connection
   * when the process is terminated.
   *
   * @param {import('pg').PoolConfig} config - PostgreSQL client configuration object.
   *                          Must be compatible with the `pg` Pool constructor.
   * @throws {Error} If a SQL engine is already initialized for this instance.
   */
  async initPostgre(config) {
    if (this.isSqlEngineEmpty()) {
      /** @type {PgPool} */
      this.#db = new pg.Pool(config);

      // Set up the SQL methods (all, get, run)
      this.setPostgre(this.#db);

      // Connect to the PostgreSQL database
      await this.#db.connect();
    } else throw new Error('SQL has already been initialized in this instance!');
  }

  /**
   * Initializes PostgreSQL-specific SQL methods on this instance using the provided database wrapper.
   *
   * This method sets the engine to "postgre" and defines the `all`, `get`, and `run` methods,
   * wrapping around the provided `db` interface.
   *
   * @param {PgPool} db - A PostgreSQL database instance that exposes `open()` and `query()` methods.
   * @throws {Error} If a SQL engine is already set for this instance.
   */
  setPostgre(db) {
    if (!(db instanceof pg.Pool)) throw new Error('Invalid type for db. Expected a PostgreSQL.');
    if (!this.getSqlEngine()) {
      this.setSqlEngine('postgre');

      /**
       * Checks if the given error is a connection error.
       *
       * @param {any} err - The error object to evaluate.
       * @returns {boolean} Returns true if the error is a connection error.
       */
      const isConnectionError = (err) => this.isConnectionError(err);

      /**
       * Emits a 'connection-error' event if the error is related to connection issues.
       *
       * @param {any} err - The error object to check and possibly emit.
       * @returns {void}
       */
      const rejectConnection = (err) => {
        if (isConnectionError(err)) this.emit(PuddySqlEvents.ConnectionError, err);
      };
      db.on('error', rejectConnection);

      const getId = () => this.#debugCount++;
      const isDebug = () => this.#debug;

      /**
       * Sends SQL debug information to the console, including query and parameters.
       *
       * @param {number} id - The debug operation ID.
       * @param {string} debugName - An optional label to identify the debug context.
       * @param {string} query - The SQL query being executed.
       * @param {any[]} params - The parameters passed to the query.
       * @returns {void}
       */
      const sendSqlDebug = (id, debugName, query, params) => {
        if (isDebug()) {
          console.log(this.#debugConsoleText(id, debugName), params);
          console.log(this.#debugSql(query));
        }
      };

      /**
       * Sends SQL result debug information to the console.
       *
       * @param {number} id - The debug operation ID.
       * @param {string} debugName - An optional label to identify the debug context.
       * @param {string} type - Optional descriptor of the operation type.
       * @param {any} data - The result data to output.
       * @returns {void}
       */
      const sendSqlDebugResult = (id, debugName, type, data) => {
        if (isDebug())
          console.log(
            this.#debugConsoleText(id, debugName, type),
            typeof data !== 'undefined' &&
              data !== null &&
              (!Array.isArray(data) || data.length > 0)
              ? data
              : 'Success!',
          );
      };

      /**
       * Executes a query expected to return multiple rows.
       *
       * @param {string} query - The SQL query to execute.
       * @param {any[*]} [params=[]] - Optional query parameters.
       * @returns {Promise<Array<Object>|null>} Resolves with an array of result rows or null if invalid.
       */
      this.all = async function (query, params = [], debugName = '') {
        try {
          validatePostgresParams(query, params);
          const id = getId();
          sendSqlDebug(id, debugName, query, params);
          const res = await db.query(query, params);
          sendSqlDebugResult(id, debugName, '', res);
          return isJsonObject(res) && Array.isArray(res.rows) ? res.rows : null;
        } catch (err) {
          rejectConnection(err);
          throw err;
        }
      };

      /**
       * Executes a query expected to return a single row.
       *
       * @param {string} query - The SQL query to execute.
       * @param {any[*]} [params=[]] - Optional query parameters.
       * @returns {Promise<Record<any, any>|null>} Resolves with the first row of the result or null if not found.
       */
      this.get = async function (query, params = [], debugName = '') {
        try {
          validatePostgresParams(query, params);
          const id = getId();
          sendSqlDebug(id, debugName, query, params);
          const res = await db.query(query, params);
          sendSqlDebugResult(id, debugName, '', res);
          return isJsonObject(res) && Array.isArray(res.rows) && isJsonObject(res.rows[0])
            ? res.rows[0]
            : null;
        } catch (err) {
          rejectConnection(err);
          throw err;
        }
      };

      /**
       * Executes a query without expecting a specific row result.
       *
       * @param {string} query - The SQL query to execute.
       * @param {any[*]} params - Query parameters.
       * @returns {Promise<Record<any, any>|null>} Resolves with the result object or null if invalid.
       */
      this.run = async function (query, params, debugName = '') {
        try {
          validatePostgresParams(query, params);
          const id = getId();
          sendSqlDebug(id, debugName, query, params);
          const res = await db.query(query, params);
          sendSqlDebugResult(id, debugName, '', res);
          return isJsonObject(res) ? res : null;
        } catch (err) {
          rejectConnection(err);
          throw err;
        }
      };
    } else {
      throw new Error('SQL has already been initialized in this instance!');
    }
  }

  /**
   * Gracefully destroys the current instance by:
   * - Removing all internal and system event listeners;
   * - Properly closing the database connection based on the SQL engine in use.
   *
   * Supports both PostgreSQL (`postgre`) and SQLite3 (`sqlite3`) engines.
   * Errors during database disconnection are caught and logged to the console.
   *
   * @returns {Promise<void>} Resolves when all cleanup operations are complete.
   */
  async destroy() {
    this.removeAllListeners();

    const sqlEngine = this.getSqlEngine();
    if (sqlEngine === 'postgre') await this.#db.end().catch(console.error);
    if (sqlEngine === 'sqlite3') await this.#db.close().catch(console.error);
  }
}

export default PuddySqlInstance;
