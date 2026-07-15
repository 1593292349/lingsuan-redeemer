const LINGSUAN_ORIGIN = 'https://lingsuan.top';

function normalizeCodes(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function isLingsuanPageUrl(value) {
  try {
    return new URL(value).origin === LINGSUAN_ORIGIN;
  } catch {
    return false;
  }
}

const supportedPage = document.querySelector('#supported-page');
const unsupportedPage = document.querySelector('#unsupported-page');
const form = document.querySelector('#redeem-form');
const codesInput = document.querySelector('#codes');
const concurrencyInput = document.querySelector('#concurrency');
const submitButton = document.querySelector('#submit');
const refreshButton = document.querySelector('#refresh-page');
const authStatus = document.querySelector('#auth-status');
const resultSection = document.querySelector('#result');

async function getActiveLingsuanTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return Number.isInteger(tab?.id) && isLingsuanPageUrl(tab.url) ? tab : null;
}

function setAuthorizationStatus(status) {
  authStatus.className = 'status';
  if (!status.captured) {
    authStatus.textContent = '未捕获 Authorization：请刷新已登录的灵算页面。';
    authStatus.classList.add('warn');
    return;
  }

  const capturedAt = new Date(status.capturedAt).toLocaleTimeString();
  authStatus.textContent = `已捕获 Authorization（${capturedAt}），可开始兑换。`;
  authStatus.classList.add('ok');
}

async function refreshAuthorizationStatus(focusCodes = false) {
  try {
    const tab = await getActiveLingsuanTab();
    supportedPage.hidden = !tab;
    unsupportedPage.hidden = Boolean(tab);
    if (!tab) return;
    if (focusCodes) codesInput.focus();

    const status = await chrome.runtime.sendMessage({ type: 'getAuthorizationStatus', tabId: tab.id });
    if (!status.ok) throw new Error(status.message);
    setAuthorizationStatus(status);
  } catch {
    supportedPage.hidden = false;
    unsupportedPage.hidden = true;
    authStatus.textContent = '无法读取扩展状态，请在 chrome://extensions 重新加载插件。';
    authStatus.className = 'status warn';
  }
}

function showMessage(message, isError = false) {
  resultSection.hidden = false;
  resultSection.replaceChildren();
  const line = document.createElement('p');
  line.className = `summary${isError ? ' error' : ''}`;
  line.textContent = message;
  resultSection.append(line);
}

function resultMessage(result) {
  if (result.ok) return result.data?.message ?? '兑换成功';
  return result.message ?? `HTTP ${result.status ?? '错误'}`;
}

function renderResults(response) {
  const successCount = response.results.filter((result) => result.ok).length;
  const fragment = document.createDocumentFragment();
  const summary = document.createElement('p');
  summary.className = 'summary';
  summary.textContent = `完成：成功 ${successCount}，失败 ${response.results.length - successCount}，并发 ${response.concurrency}`;
  fragment.append(summary);

  response.results.forEach((result) => {
    const item = document.createElement('div');
    item.className = `result-item ${result.ok ? 'ok' : 'error'}`;
    item.textContent = `${result.ok ? '成功' : '失败'} · ${result.code} · ${resultMessage(result)}`;
    fragment.append(item);
  });

  resultSection.hidden = false;
  resultSection.replaceChildren(fragment);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'session' && changes.lingsuanAuthorization) {
    refreshAuthorizationStatus();
  }
});

refreshButton.addEventListener('click', async () => {
  try {
    const tab = await getActiveLingsuanTab();
    if (!tab) {
      showMessage('请先在当前窗口打开已登录的 https://lingsuan.top 页面。', true);
      return;
    }

    await chrome.tabs.reload(tab.id);
    authStatus.textContent = '页面正在刷新；Authorization 捕获后会自动更新。';
    authStatus.className = 'status';
  } catch {
    showMessage('无法刷新兑换页面，请稍后重试。', true);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const codes = normalizeCodes(codesInput.value);
  if (codes.length === 0) {
    showMessage('请至少输入一个兑换码。', true);
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = '兑换中…';
  try {
    const tab = await getActiveLingsuanTab();
    if (!tab) {
      showMessage('请先在当前窗口打开已登录的 https://lingsuan.top 页面。', true);
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'redeemCodes',
      tabId: tab.id,
      codes,
      concurrency: concurrencyInput.value,
    });

    if (!response.ok) {
      showMessage(response.message ?? '兑换请求失败。', true);
      return;
    }
    renderResults(response);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : '无法与后台脚本通信。', true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = '开始兑换';
    refreshAuthorizationStatus();
  }
});

refreshAuthorizationStatus(true);
