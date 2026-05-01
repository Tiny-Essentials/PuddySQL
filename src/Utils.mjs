/**
 * Converts PostgreSQL-style SQL placeholders ($1, $2, ...) to MySQL-style placeholders (?).
 * Maintains full compatibility with repeated and unordered params.
 *
 * @param {string} query - The PostgreSQL-style query.
 * @param {any[]} params - Parameters corresponding to placeholders.
 * @param {(reason?: any) => void} [errCallback]
 * @returns {{ query: string, params: any[] }} - MySQL-compatible query and reordered parameters.
 */
export function convertPgToMySQLSyntax(query, params, errCallback) {
  /** @param {string} msg */
  const sendError = (msg) => {
    const err = new Error(msg);
    if (typeof errCallback === 'function') return errCallback(err);
    throw err;
  };

  /** @type {any[]} */
  const usedParams = [];
  const transformedQuery = query.replace(/\$([0-9]+)/g, (_, numStr) => {
    const index = parseInt(numStr, 10) - 1;
    if (index < 0 || index >= params.length) sendError(`Invalid parameter reference: $${numStr}`);
    usedParams.push(params[index]);
    return '?';
  });

  return { query: transformedQuery, params: usedParams };
}

/**
 * Validates if a PostgreSQL-style query with $1, $2, ... placeholders
 * matches the number of parameters in the params array.
 * Ignores other placeholder styles like :name or ?.
 *
 * @param {string} query - SQL query with $n placeholders.
 * @param {any[]} params - Array of parameter values.
 * @param {(reason?: any) => void} [errCallback]
 * @returns {true} Returns true if valid.
 * @throws {Error} Throws if placeholders reference missing parameters or invalid indexes.
 */
export function validatePostgresParams(query, params, errCallback) {
  const placeholders = new Set();
  const matches = [...query.matchAll(/\$([0-9]+)/g)];

  /** @param {string} msg */
  const sendError = (msg) => {
    const err = new Error(msg);
    if (typeof errCallback === 'function') return errCallback(err);
    throw err;
  };

  for (const [, numStr] of matches) {
    const index = parseInt(numStr, 10);
    if (index <= 0) {
      sendError(`Invalid placeholder $${index}: must be greater than 0.`);
    }
    if (index > params.length) {
      sendError(`Query references $${index} but only ${params.length} parameter(s) provided.`);
    }
    placeholders.add(index);
  }

  // Check for gaps: all numbers between 1 and max index must be present
  const maxIndex = placeholders.size > 0 ? Math.max(...placeholders) : 0;
  for (let i = 1; i <= maxIndex; i++) {
    if (!placeholders.has(i)) {
      sendError(`Placeholder $${i} is missing but higher placeholders exist.`);
    }
  }

  return true;
}
