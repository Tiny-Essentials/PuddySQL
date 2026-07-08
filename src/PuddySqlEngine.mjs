import { EventEmitter } from 'events';

class PuddySqlEngine extends EventEmitter {
  constructor() {
    super();
  }

  /** @type {string} */
  #sqlEngine = '';

  /**
   * Checks whether the SQL engine identifier is empty.
   *
   * Returns `true` if the SQL engine is either `null`, `undefined`, or an empty string.
   *
   * @returns {boolean} Whether the SQL engine is unset or empty.
   */
  isSqlEngineEmpty() {
    return typeof this.#sqlEngine !== 'string' || this.#sqlEngine.trim() === '';
  }

  /**
   * Returns the current SQL engine identifier used by this instance.
   *
   * Throws an error if the engine has not been defined.
   *
   * @returns {string} The name of the current SQL engine.
   * @throws {Error} If the SQL engine is not defined.
   */
  getSqlEngine() {
    if (typeof this.#sqlEngine !== 'string' || this.#sqlEngine.trim() === '')
      throw new Error('SQL engine is not defined.');
    return this.#sqlEngine;
  }

  /**
   * Sets the SQL engine identifier for this instance.
   *
   * This can only be set once, and only with a valid string.
   * Subsequent attempts or invalid types will throw an error.
   *
   * @param {string} engine - The SQL engine name to set (e.g., 'sqlite3' or 'postgre').
   * @throws {Error} If the SQL engine is already set or if the input is not a string.
   */
  setSqlEngine(engine) {
    if (typeof this.#sqlEngine === 'string' && this.#sqlEngine.length > 0)
      throw new Error('SQL engine has already been set and cannot be changed.');
    if (typeof engine !== 'string' || engine.trim() === '')
      throw new Error('Invalid SQL engine: only non-empty strings are allowed.');

    this.#sqlEngine = engine;
  }

  /**
   * Checks if the given error message indicates a connection error based on the SQL engine in use.
   *
   * This method evaluates if the provided error message contains any known connection error codes
   * for the current SQL engine (PostgreSQL or SQLite3).
   *
   * @param {Error} err - The error message to check.
   * @returns {boolean} True if the error message matches any known connection error codes; otherwise, false.
   */
  isConnectionError(err) {
    if (typeof err !== 'object' || err === null || Array.isArray(err))
      throw new TypeError('err must be a plain object');
    const sqlEngine = this.getSqlEngine();
    if (typeof sqlEngine === 'string') {
      // PostgreSQL
      if (sqlEngine === 'postgre') {
        const codes = [
          'ECONNREFUSED',
          'ENOTFOUND',
          'EHOSTUNREACH',
          'ETIMEDOUT',
          'EPIPE',
          '28P01',
          '3D000',
          '08006',
          '08001',
          '08004',
          '53300',
          '57P01',
        ];
        // @ts-ignore
        for (const code of codes) if (err.code === code) return true;
      }

      // Sqlite3
      if (sqlEngine === 'sqlite3' && typeof err.message === 'string')
        return err.message.includes('SQLITE_CANTOPEN');
    }
    return false;
  }

  /**
   * Throws an error because no SQL engine was selected.
   * @param {string} method - Method name that was called.
   * @returns {never}
   */
  #missingEngineError(method) {
    throw new Error(
      `[PuddySql] You must choose a SQL engine (sqlite3 or pg) before using the '${method}' method.`,
    );
  }

  /**
   * Executes a query to get all rows from a database table.
   * @function
   * @async
   * @param {string} query - The SQL query to execute.
   * @param {any[*]} [params] - The parameters to bind to the query.
   * @param {string} [debugName] - Optional label or context name for the debug log.
   * @returns {Promise<any[*]>} A promise that resolves to an array of rows.
   * @throws {Error} Throws an error if the query fails.
   */
  all = (query, params, debugName = '') =>
    new Promise((resolve, reject) => reject(this.#missingEngineError('all')));

  /**
   * Executes a query to get a single row from a database table.
   * @function
   * @async
   * @param {string} query - The SQL query to execute.
   * @param {any[*]} [params] - The parameters to bind to the query.
   * @param {string} [debugName] - Optional label or context name for the debug log.
   * @returns {Promise<Record<any, any>|null>} A promise that resolves to a single row object.
   * @throws {Error} Throws an error if the query fails.
   */
  get = (query, params, debugName = '') =>
    new Promise((resolve, reject) => reject(this.#missingEngineError('get')));

  /**
   * Executes an SQL statement to modify the database (e.g., INSERT, UPDATE).
   * @function
   * @async
   * @param {string} query - The SQL query to execute.
   * @param {any[*]} params - The parameters to bind to the query.
   * @param {string} [debugName] - Optional label or context name for the debug log.
   * @returns {Promise<Record<any, any>|null>} A promise that resolves to the result of the query execution.
   * @throws {Error} Throws an error if the query fails.
   */
  run = (query, params, debugName = '') =>
    new Promise((resolve, reject) => reject(this.#missingEngineError('run')));
}

export default PuddySqlEngine;
