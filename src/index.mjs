import { pg, sqlite3 } from './Modules.mjs';
import * as Utils from './Utils.mjs';
import PuddySqlEvents from './PuddySqlEvents.mjs';
import PuddySqlInstance from './PuddySqlInstance.mjs';
import PuddySqlQuery from './PuddySqlQuery.mjs';
import PuddySqlTags from './PuddySqlTags.mjs';
import PuddySqlMigrator from './PuddySqlMigrator.mjs';

class PuddySql {
  static Instance = PuddySqlInstance;
  static Query = PuddySqlQuery;
  static Tags = PuddySqlTags;
  static Events = PuddySqlEvents;
  static Migrator = PuddySqlMigrator;
  static Utils = Utils;
  static pg = pg;
  static sqlite3 = sqlite3;

  /**
   * This constructor is intentionally blocked.
   *
   * ⚠️ You must NOT instantiate PuddySql directly.
   * To create a working instance, use {@link PuddySql.Instance}:
   *
   * ```js
   * const client = new PuddySql.Instance();
   * ```
   *
   * @constructor
   * @throws {Error} Always throws an error to prevent direct instantiation.
   */
  constructor() {
    throw new Error('You must use new PuddySql.Instance() to create your new instance.');
  }
}

export default PuddySql;
