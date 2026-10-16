# 项目架构速览

NiceTab 是基于 WXT、React、Ant Design 和浏览器存储的多入口标签页管理扩展。完整的现有架构说明见 `../ARCHITECTURE.md`；本文件作为可迁移项目知识入口，记录当前确认的模块关系。

- `entrypoints/background/` 处理浏览器生命周期、事件、命令和消息。
- `entrypoints/options/` 是管理页；`entrypoints/popup/` 是工具栏弹窗；`entrypoints/content/` 处理页面级交互。
- `entrypoints/common/storage/` 持有设置、标签列表、回收站和同步状态等持久数据；`entrypoints/common/` 的其余文件提供共享工具、组件和浏览器适配。
- `wxt.config.ts` 生成清单并区分 Chromium 和 Firefox；`public/` 静态文件随扩展打包。
- 构建由 `package.json` 的 pnpm 脚本驱动，输出到 `.output/`；Chromium 的已解压目录是 `.output/chrome-mv3`。
- `public/release.json` 保存独立个人构建号；`entrypoints/common/release/` 校验远端清单并限制下载地址为同源 HTTPS。`entrypoints/common/hooks/usePersonalRelease.ts` 和共享提示组件供管理页、弹窗使用；Firefox 不发起此项检查。该状态不写入浏览器存储。
- `.github/workflows/build-extension.yml` 在推送 `master` 后构建 Chromium ZIP；`scripts/prepare-release.mjs` 生成带提交 SHA 的包和 `latest.json`，先作为 GitHub Actions 工件保存。服务器传输尚未接入。
- 外部依赖包括浏览器扩展 API；现有可选远程同步通过 GitHub/Gitee Gist 和 WebDAV。尚未建立自有服务器的发布链路。

当前验证命令见 `docs/engineering/workflow.md` 和 `docs/deployment/release.md`：`pnpm test:release`、`pnpm compile`、`pnpm lint:no-fix`、`pnpm build`、`pnpm zip`、`pnpm build:firefox`。实际浏览器行为还需加载构建结果并重载扩展检查。
