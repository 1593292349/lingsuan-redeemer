import test from 'node:test';
import assert from 'node:assert/strict';

import { REQUEST_TYPES } from '../request-capture.js';

test('webRequest capture only registers request types accepted by Chrome', () => {
  assert.deepEqual(REQUEST_TYPES, ['xmlhttprequest']);
});
