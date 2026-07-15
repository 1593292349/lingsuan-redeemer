import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRedeemEndpoint, redeemCode } from '../api.js';

test('buildRedeemEndpoint encodes the timezone query used by the site API', () => {
  assert.equal(
    buildRedeemEndpoint('Asia/Shanghai'),
    'https://lingsuan.top/api/v1/redeem?timezone=Asia%2FShanghai',
  );
});

test('redeemCode posts one code with the captured Authorization header', async () => {
  const calls = [];
  const result = await redeemCode({
    authorization: 'Bearer test-token',
    code: 'CODE-1',
    timezone: 'Asia/Shanghai',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ message: '兑换成功' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.deepEqual(calls, [{
    url: 'https://lingsuan.top/api/v1/redeem?timezone=Asia%2FShanghai',
    options: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ code: 'CODE-1' }),
    },
  }]);
  assert.deepEqual(result, { ok: true, status: 200, data: { message: '兑换成功' } });
});

test('redeemCode returns the API detail when the request is rejected', async () => {
  const result = await redeemCode({
    authorization: 'Bearer test-token',
    code: 'USED-CODE',
    fetchImpl: async () => new Response(JSON.stringify({ detail: '兑换码已使用' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    message: '兑换码已使用',
    data: { detail: '兑换码已使用' },
  });
});
