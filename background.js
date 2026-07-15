const API_URL_PATTERN = 'https://lingsuan.top/api/v1/*';
const PAGE_ORIGIN = 'https://lingsuan.top';
const AUTH_STORAGE_KEY = 'lingsuanAuthorization';
let authorizationStorageFailed = false;

function isLingsuanPageUrl(value) {
  try {
    return new URL(value).origin === PAGE_ORIGIN;
  } catch {
    return false;
  }
}

function isPopupSender(sender) {
  return sender?.id === chrome.runtime.id
    && sender.url === chrome.runtime.getURL('popup.html');
}

async function getAuthorization() {
  const stored = await chrome.storage.session.get(AUTH_STORAGE_KEY);
  const authorization = stored[AUTH_STORAGE_KEY];
  return typeof authorization?.value === 'string' ? authorization : null;
}

async function sendRedeemRequest(tabId, codes, concurrency) {
  if (authorizationStorageFailed) {
    return {
      ok: false,
      code: 'STORAGE_ERROR',
      message: '无法保存 Authorization，请重新加载页面后再试。',
    };
  }

  let authorization;
  try {
    authorization = await getAuthorization();
  } catch {
    return {
      ok: false,
      code: 'STORAGE_ERROR',
      message: '无法读取扩展会话状态，请重新加载插件后再试。',
    };
  }

  if (!authorization) {
    return {
      ok: false,
      code: 'AUTHORIZATION_NOT_CAPTURED',
      message: '尚未捕获 Authorization。请刷新当前已登录的 lingsuan.top 页面后再试。',
    };
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isLingsuanPageUrl(tab.url)) {
      return {
        ok: false,
        code: 'LINGSUAN_PAGE_NOT_ACTIVE',
        message: '请在已登录的 https://lingsuan.top 页面执行兑换。',
      };
    }
    return await chrome.tabs.sendMessage(tabId, {
      type: 'redeemCodesInPage',
      codes,
      authorization: authorization.value,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      concurrency,
    });
  } catch {
    return {
      ok: false,
      code: 'CONTENT_SCRIPT_UNAVAILABLE',
      message: '页面脚本尚未加载。请重新加载当前 lingsuan.top 页面后再试。',
    };
  }
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.initiator !== PAGE_ORIGIN) return;
    const value = details.requestHeaders?.find(
      (header) => typeof header.name === 'string'
        && header.name.toLowerCase() === 'authorization',
    )?.value;
    if (!value) return;

    void chrome.storage.session.set({
      [AUTH_STORAGE_KEY]: { value, capturedAt: Date.now() },
    }).then(
      () => {
        authorizationStorageFailed = false;
      },
      () => {
        authorizationStorageFailed = true;
      },
    );
  },
  { urls: [API_URL_PATTERN], types: ['xmlhttprequest'] },
  ['requestHeaders', 'extraHeaders'],
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isPopupSender(sender)) return false;

  if (message?.type === 'getAuthorizationStatus') {
    if (authorizationStorageFailed) {
      sendResponse({ ok: false, message: '无法保存 Authorization，请重新加载页面后再试。' });
      return false;
    }

    getAuthorization()
      .then((authorization) => sendResponse({
        ok: true,
        captured: Boolean(authorization),
        capturedAt: authorization?.capturedAt ?? null,
      }))
      .catch(() => sendResponse({ ok: false, message: '无法读取扩展会话状态，请重新加载插件后再试。' }));
    return true;
  }

  if (message?.type !== 'redeemCodes') return false;
  const codes = message.codes;
  if (!Array.isArray(codes) || codes.length === 0 || !Number.isInteger(message.tabId)) {
    sendResponse({ ok: false, message: '没有可兑换的兑换码或当前页面不可用。' });
    return false;
  }

  sendRedeemRequest(message.tabId, codes, message.concurrency).then(sendResponse);
  return true;
});
