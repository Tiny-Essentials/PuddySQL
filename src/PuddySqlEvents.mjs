/**
 * List of event names used by PuddySql in the EventEmitter.
 * Each key maps to its string identifier.
 */
class PuddySqlEvents {
  /**
   * This class is not meant to be instantiated.
   *
   * PuddySqlEvents is a static-only class. All its members should be accessed directly through the class.
   *
   * @throws {Error} Always throws an error saying you can't summon it like a tiny pudding.
   */
  constructor() {
    throw new Error(
      "Oops! PuddySqlEvents isn't something you can summon like a tiny pudding. Just use it statically 🍮 :3",
    );
  }

  /**
   * Constant identifier used to represent a connection failure.
   *
   * This can be thrown, logged, or compared when the database connection is not available.
   *
   * @type {string}
   * @static
   */
  static ConnectionError = 'Connection-Error';

  /**
   * @returns {string[]}
   */
  static get all() {
    const items = [];
    for (const key of Object.getOwnPropertyNames(this)) {
      // Skip getters or non-string static properties
      if (key !== 'name') {
        const descriptor = Object.getOwnPropertyDescriptor(this, key);
        if (descriptor && typeof descriptor.value === 'string') items.push(descriptor.value);
      }
    }
    return items;
  }

  /**
   * @param {string} event
   * @returns {boolean}
   */
  static isValid(event) {
    return this.all.includes(event);
  }

  /**
   * Constant identifier used when a migration starts.
   * @type {string}
   * @static
   */
  static MigrationStarting = 'Migration-Starting';

  /**
   * Constant identifier used when a migration finishes successfully.
   * @type {string}
   * @static
   */
  static MigrationCompleted = 'Migration-Completed';

  /**
   * Constant identifier used when the entire migration process finishes.
   * @type {string}
   * @static
   */
  static MigrationFinished = 'Migration-Finished';

  /**
   * Constant identifier used when a migration encounters an error.
   * @type {string}
   * @static
   */
  static MigrationError = 'Migration-Error';
}

export default PuddySqlEvents;
