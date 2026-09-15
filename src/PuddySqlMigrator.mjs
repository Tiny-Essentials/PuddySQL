import PuddySqlEvents from './PuddySqlEvents.mjs';

/**
 * @typedef {Object} MigrationConfig
 * @property {number} version - The target version number.
 * @property {(db: import('./PuddySqlInstance.mjs').default) => Promise<void>} callback - The migration script.
 */

/**
 * @template {import('./PuddySqlInstance.mjs').default} Instance
 * @typedef {(db: Instance) => Promise<void>} MigratorCallback
 */

/**
 * @template {import('./PuddySqlInstance.mjs').default} Instance
 * PuddySqlMigrator manages database schema versioning and migrations.
 */
class PuddySqlMigrator {
  /** @type {Instance} */
  #db;
  /** @type {string} */
  #tableName;
  /** @type {Map<number, MigratorCallback<Instance>>} */
  #migrations = new Map();

  /**
   * @param {Instance} db - The PuddySql instance.
   * @param {string} [tableName='puddy_migrations'] - The table name for versioning.
   */
  constructor(db, tableName = 'puddy_migrations') {
    this.#db = db;
    this.#tableName = tableName;
  }

  /**
   * Registers a migration callback for a specific version.
   *
   * @param {number} version - The version number this migration belongs to.
   * @param {MigratorCallback<Instance>} callback - Async function containing the migration logic.
   * @throws {TypeError} If version is not a number or callback is not a function.
   */
  addMigration(version, callback) {
    if (typeof version !== 'number' || Number.isNaN(version))
      throw new TypeError('Version must be a valid number.');
    if (typeof callback !== 'function')
      throw new TypeError('Migration callback must be a function.');

    this.#migrations.set(version, callback);
  }

  /**
   * Ensures the migration tracking table exists and has an initial version.
   * @returns {Promise<void>}
   */
  async #ensureMigrationTable() {
    const createTableQuery = `CREATE TABLE IF NOT EXISTS ${this.#tableName} (version INTEGER PRIMARY KEY)`;
    await this.#db.run(createTableQuery, undefined, 'migrator.ensureTable');

    // Check if a row exists; if not, initialize it at version 0.
    const checkQuery = `SELECT COUNT(*) as count FROM ${this.#tableName}`;
    const result = await this.#db.get(checkQuery, [], 'migrator.checkExists');

    // Handling result difference between SQLite and PG via the existing resultChecker
    const count = result?.count ?? 0;

    if (count === 0) {
      await this.#db.run(
        `INSERT INTO ${this.#tableName} (version) VALUES (0)`,
        undefined,
        'migrator.initVersion',
      );
    }
  }

  /**
   * Retrieves the current version from the database.
   * @returns {Promise<number>}
   */
  async #getCurrentVersion() {
    const query = `SELECT version FROM ${this.#tableName}`;
    const result = await this.#db.get(query, [], 'migrator.getCurrentVersion');
    return result?.version ?? 0;
  }

  /**
   * Updates the version in the database.
   * @param {number} version
   * @returns {Promise<void>}
   */
  async #setVersion(version) {
    const query = `UPDATE ${this.#tableName} SET version = $1`;
    await this.#db.run(query, [version], 'migrator.setVersion');
  }

  /**
   * Starts the migration process.
   *
   * @param {number} targetVersion - The version the database should reach.
   * @returns {Promise<void>} Resolves when all migrations are completed.
   * @throws {Error} If a migration fails.
   */
  async start(targetVersion) {
    await this.#ensureMigrationTable();
    const currentVersion = await this.#getCurrentVersion();

    if (targetVersion <= currentVersion) {
      return;
    }

    // Filter and sort migrations: oldest to newest
    const pendingVersions = Array.from(this.#migrations.keys())
      .filter((v) => v > currentVersion && v <= targetVersion)
      .sort((a, b) => a - b);

    for (const version of pendingVersions) {
      try {
        this.#db.debugConsoleText(version, 'MIGRATION', 'STARTING');
        this.#db.emit(PuddySqlEvents.MigrationStarting, version);

        const migrationFn = this.#migrations.get(version);
        if (!migrationFn) throw new Error('Migration script not found!');
        await migrationFn(this.#db);

        await this.#setVersion(version);

        this.#db.debugConsoleText(version, 'MIGRATION', 'SUCCESS');
        this.#db.emit(PuddySqlEvents.MigrationCompleted, version);
      } catch (err) {
        this.#db.debugConsoleText(version, 'MIGRATION', 'ERROR');
        this.#db.emit(PuddySqlEvents.MigrationError, { version, error: err });
        throw new Error(
          `Migration to version ${version} failed: ${err instanceof Error ? err.message : 'Unknown Error'}`,
        );
      }
    }

    this.#db.emit(PuddySqlEvents.MigrationFinished);
  }
}

export default PuddySqlMigrator;
