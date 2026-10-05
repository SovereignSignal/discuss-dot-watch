'use strict';
const {isAbsolute} = require('node:path');
const {globSync} = require('tinyglobby');

/** The pinned Next lint plugin uses only globSync(string, {onlyDirectories:true}).
 * Fail loudly if that upstream contract expands, instead of silently claiming
 * compatibility with the full fast-glob API. Output keeps original absolute
 * versus relative semantics and does not add directory trailing separators.
 */
exports.globSync = function nextRootGlob(pattern, options = {}) {
  if (typeof pattern !== 'string' || Object.keys(options).some(key => key !== 'onlyDirectories')) {
    throw new TypeError('Unsupported Next lint glob contract');
  }
  if (pattern.length > 8192) throw new RangeError('Root glob too long');
  return globSync(pattern, {onlyDirectories: options.onlyDirectories === true, absolute: isAbsolute(pattern)})
    .map(value => value.length > 1 ? value.replace(/\/$/, '') : value);
};
