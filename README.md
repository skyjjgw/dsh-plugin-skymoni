# Skymoni 账户 · DeepSeek Harness 桌面插件

在 DeepSeek Harness 桌面端左侧用 **Skymoni 账户登录**，授权后在 DSH 原生模型选择器里选择 **Skymoni** 的模型。使用 `skymoni.com` 签到系统的同一个账户和账户额度。

## 安装

支持 DeepSeek Harness 桌面版 **0.2.1-rc.2**。打开左侧 **插件 → 添加插件**，输入：

```text
github:skyjjgw/dsh-plugin-skymoni#v0.1.1
```

也可在同一窗口输入 Release 中 `.tgz` 文件的完整本地路径。安装后按 DSH 的提示刷新插件或重启桌面端。

## 使用

1. 点击左侧带头像的 **Skymoni 账户登录**。
2. 选择 **使用 Skymoni 账户登录**，打开网站授权页，用原有签到账户确认。
3. 回到 DSH 会话，在输入框的模型选择器中选择 **Skymoni** 下的模型。
4. 如需切换账户，先在插件页退出，再发起授权。

模型目录同时核对当前账户的对话模型和令牌可调用的模型。推理、工具调用和结算继续通过 DSH 与 Skymoni 各自的原有机制处理。

## 账户和凭据

密码与网站登录 Cookie 由 `skymoni.com` 处理。插件把自己的设备授权会话保存在 DSH 原生凭据服务的 `skymoni-account/session` 记录中。DSH 默认文件凭据服务的保护方式取决于用户的安装环境。

当前站点接口返回同一账户的 Skivu 专用 API Key。插件仅在宿主进程内存中持有该 Key，每次模型调用前验证设备会话。退出会清除插件授权并尝试撤销对应的设备会话。Skivu 专用 API Key 继续供同账户既有客户端使用。

该插件只访问 `https://skymoni.com` 的授权、账户、模型目录和推理接口。会话正文按所选模型的正常调用发送，插件没有额外的遥测、签到任务或安装脚本。

## 开发验证

使用 Node.js 24.9+ 和 DSH 0.2.1-rc.2 对应依赖运行 `npm run check`、`npm test` 和 `npm pack`。测试使用合成账户及模型响应。许可证见 `LICENSE.txt` 和 `THIRD_PARTY.md`。
