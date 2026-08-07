// @paralleldrive/cuid2 is pure ESM and reaches the suite only through
// supertest → superagent → formidable, which we never exercise (all requests are
// JSON). Jest cannot load it, so it is stubbed with an equivalent-enough shim.
const { randomBytes } = require('crypto');

const createId = () => randomBytes(12).toString('hex');

module.exports = {
  createId,
  init: () => createId,
  getConstants: () => ({ defaultLength: 24, bigLength: 32 }),
  isCuid: (value) => typeof value === 'string' && value.length > 0,
};
