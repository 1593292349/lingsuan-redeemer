import { redeemCode } from './api.js';
import { REQUEST_TYPES } from './request-capture.js';
import { runWithConcurrency } from './shared.js';

const API_URL_PATTERN = 'https://lingsuan.top/api/v1/*';
const PAGE_ORIGIN = 'https://lingsuan.top';
const AUTH_STORAGE_KEY = 'lingsuanAuthorization';
const MAX_CONCURRENCY = 10;

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.initiator !== PAGE_ORIGIN) return;

    const authorization = details.requestHeaders?.find(
      (header) => header.name.toLowerCase() === 'authorization',
    )?.value;
    if (!authorization) return;

    chrome.storage.session.set({
      [AUTH_STORAGE_KEY]: {
        value: authorization,
        capturedAt: Date.now(),
      },
    });
  },
  { urls: [API_URL_PATTERN], types: REQUEST_TYPES },
  ['requestHeaders', 'extraHeaders'],
);

function toConcurrency(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_CONCURRENCY);
}

async function getAuthorization() {
  const stored = await chrome.storage.session.get(AUTH_STORAGE_KEY);
  return stored[AUTH_STORAGE_KEY] ?? null;
}

async function getAuthorizationStatus() {
  const authorization = await getAuthorization();
  return {
    captured: Boolean(authorization?.value),
    capturedAt: authorization?.capturedAt ?? null,
  };
}

async function redeemCodes(codes, requestedConcurrency) {
  const authorization = await getAuthorization();
  if (!authorization?.value) {
    return {
      ok: false,
      code: 'AUTHORIZATION_NOT_CAPTURED',
      message: '尚未捕获 Authorization。请先打开并刷新 lingsuan.top 的已登录页面，再重试。',
    };
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const concurrency = toConcurrency(requestedConcurrency);
  const results = await runWithConcurrency(codes, concurrency, async (code) => {
    try {
      const response = await redeemCode({
        authorization: authorization.value,
        code,
        timezone,
      });
      return { code, ...response };
    } catch (error) {
      return {
        code,
        ok: false,
        status: null,
        message: error instanceof Error ? error.message : '网络请求失败',
        data: null,
      };
    }
  });

  return { ok: true, concurrency, results };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'getAuthorizationStatus') {
    getAuthorizationStatus().then(sendResponse);
    return true;
  }

  if (message?.type === 'redeemCodes') {
    const codes = Array.isArray(message.codes)
      ? message.codes.filter((code) => typeof code === 'string' && code.length > 0)
      : [];
    if (codes.length === 0) {
      sendResponse({ ok: false, code: 'EMPTY_CODES', message: '没有可兑换的兑换码。' });
      return false;
    }

    redeemCodes(codes, message.concurrency)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          code: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : '未知错误',
        });
      });
    return true;
  }

  return false;
});
