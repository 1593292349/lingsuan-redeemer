import { normalizeCodes } from './shared.js';

const LINGSUAN_ORIGIN = 'https://lingsuan.top';
const form = document.querySelector('#redeem-form');
const codesInput = document.querySelector('#codes');
const concurrencyInput = document.querySelector('#concurrency');
const submitButton = document.querySelector('#submit');
const refreshButton = document.querySelector('#refresh-page');
const authStatus = document.querySelector('#auth-status');
const resultSection = document.querySelector('#result');

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
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

async function refreshAuthorizationStatus() {
  try {
    setAuthorizationStatus(await sendMessage({ type: 'getAuthorizationStatus' }));
  } catch {
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
  resultSection.hidden = false;
  resultSection.replaceChildren();

  const summary = document.createElement('p');
  summary.className = 'summary';
  summary.textContent = `完成：成功 ${successCount}，失败 ${response.results.length - successCount}，并发 ${response.concurrency}`;
  resultSection.append(summary);

  response.results.forEach((result) => {
    const item = document.createElement('div');
    item.className = `result-item ${result.ok ? 'ok' : 'error'}`;
    item.textContent = `${result.ok ? '成功' : '失败'} · ${result.code} · ${resultMessage(result)}`;
    resultSection.append(item);
  });
}

refreshButton.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith(LINGSUAN_ORIGIN)) {
    showMessage('请先在当前窗口打开已登录的 https://lingsuan.top/redeem 页面。', true);
    return;
  }

  await chrome.tabs.reload(tab.id);
  authStatus.textContent = '页面正在刷新；加载完成后重新打开插件检查捕获状态。';
  authStatus.className = 'status';
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
    const response = await sendMessage({
      type: 'redeemCodes',
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

refreshAuthorizationStatus();
