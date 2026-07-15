# AGENTS.md

## 目标

Chrome MV3 批量兑换插件。用户在任意 `https://lingsuan.top/*` 页面输入多行兑换码；请求必须出现在该网页自身的 Network 面板。

## 文件职责

```text
manifest.json   扩展配置
background.js   捕获 Authorization、校验 Popup 消息、转发任务
content.js      在网页上下文请求兑换接口
popup.html/js   Popup 界面与交互
README.md       仅写最终用户安装和使用说明
.gitignore      本地 Git 配置，禁止擅自修改或删除
```

不要为少量代码新增辅助模块、依赖、构建配置或测试文件。

## 必须保持

- 页面范围是 `https://lingsuan.top/*`，不得限制为 `/redeem`。
- 兑换码仅按行 `trim()`、忽略空行；其余内容直接发送，不增加数量、长度、格式或内容限制。
- 兑换 `fetch` 必须在 `content.js`，不得移到 Service Worker。
- 并发保持 1–10；POST 不自动重试；单请求 30 秒超时。
- Authorization 仅从 `https://lingsuan.top/api/v1/*` 捕获并写入 `chrome.storage.session`。
- Authorization 不得硬编码或暴露到 UI、日志、README、错误文本或外部网络；仅允许在 `background.js → content.js` 的既定消息中传递。
- Background 只接受本扩展 `popup.html` 的消息。
- Popup 必须监听 `chrome.storage.onChanged`，Authorization 捕获后自动更新状态。
- 动态 UI 使用 `textContent`，不用 `innerHTML`。

## 修改规则

1. 修改前读取所有受影响文件，确认运行上下文（Popup / Background / Content）。
2. 只修改当前需求所需代码，不顺带重构或改变现有交互。
3. 修改消息字段时，同时更新发送方、接收方和 Popup 渲染。
4. 不修改、删除或清理 `.idea/`、`.gitignore` 或其他本地 IDE / Git 配置，除非用户明确指定。
5. 用户禁止测试：不创建、不保留、不运行测试，也不创建测试替代脚本。
6. 修改后仅允许非测试静态核对：`git diff --check`。
