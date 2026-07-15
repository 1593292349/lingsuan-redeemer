(() => {
  const API_ORIGIN = 'https://lingsuan.top';
  const REQUEST_TIMEOUT_MS = 30_000;
  const MAX_CONCURRENCY = 10;

  function buildRedeemEndpoint(timezone) {
    const query = new URLSearchParams();
    if (timezone) query.set('timezone', timezone);
    const suffix = query.size ? `?${query}` : '';
    return `${API_ORIGIN}/api/v1/redeem${suffix}`;
  }

  async function parseResponseBody(response) {
    const text = await response.text();
    if (!text) return null;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return { detail: text };

    try {
      return JSON.parse(text);
    } catch {
      return { detail: text };
    }
  }

  async function redeemCode({ authorization, code, timezone }) {
    const response = await fetch(buildRedeemEndpoint(timezone), {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({ code }),
    });
    const data = await parseResponseBody(response);

    if (response.ok) return { ok: true, status: response.status, data };

    return {
      ok: false,
      status: response.status,
      message: data?.detail ?? data?.message ?? `HTTP ${response.status}`,
      data,
    };
  }

  function toConcurrency(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed < 1) return 1;
    return Math.min(parsed, MAX_CONCURRENCY);
  }

  async function redeemCodesInPage(codes, authorization, timezone, requestedConcurrency) {
    const concurrency = toConcurrency(requestedConcurrency);
    const results = new Array(codes.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < codes.length) {
        const index = nextIndex;
        nextIndex += 1;
        const code = codes[index];
        try {
          results[index] = { code, ...(await redeemCode({ authorization, code, timezone })) };
        } catch (error) {
          results[index] = {
            code,
            ok: false,
            status: null,
            message: error instanceof Error ? error.message : '网络请求失败',
            data: null,
          };
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, codes.length) }, () => worker()));
    return { ok: true, concurrency, results };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'redeemCodesInPage') return false;

    const codes = Array.isArray(message.codes)
      ? message.codes.filter((code) => typeof code === 'string' && code.length > 0)
      : [];
    if (codes.length === 0) {
      sendResponse({ ok: false, code: 'EMPTY_CODES', message: '没有可兑换的兑换码。' });
      return false;
    }
    if (typeof message.authorization !== 'string' || !message.authorization) {
      sendResponse({ ok: false, code: 'AUTHORIZATION_NOT_CAPTURED', message: '尚未捕获 Authorization。' });
      return false;
    }

    redeemCodesInPage(codes, message.authorization, message.timezone, message.concurrency)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          code: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        });
      });
    return true;
  });
})();
