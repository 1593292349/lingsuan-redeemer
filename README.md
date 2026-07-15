# 灵算批量兑换 Chrome 插件

该插件只针对 `https://lingsuan.top`，将粘贴文本按行拆分、去除每行首尾空白后并发调用真实兑换接口：

```text
POST https://lingsuan.top/api/v1/redeem?timezone=<当前时区>
Content-Type: application/json
Authorization: <从灵算网页已登录请求捕获的原值>

{"code":"每行兑换码"}
```

## 安装

1. 在 Chrome 打开 `chrome://extensions`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择此目录：`D:\lingsuan-redeemer`。
5. 打开已登录的 `https://lingsuan.top/redeem`，点击插件图标。
6. 点击“刷新灵算页面并捕获 Authorization”，等待页面刷新后重新打开插件，状态应显示“已捕获 Authorization”。
7. 粘贴兑换码；每行一个。设置并发数后点击“开始兑换”。

## 安全与行为

- 插件仅请求 `lingsuan.top` 的 host 权限。
- 它只监听该站 `/api/v1/*` 请求中的 `Authorization`，不会读取或展示 token 文本。
- Authorization 仅写入 `chrome.storage.session`，浏览器重启后自动消失；插件没有任何远程上传、统计或遥测。
- 每个兑换码只发送一次；对 POST 兑换请求**不自动重试**，避免网络异常时造成重复兑换。
- 并发数限制在 1–10；结果按输入顺序展示。
