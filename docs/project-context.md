# 项目当前状态

最后更新：2026-10-15

## 目标与范围

在 NiceTab 改版中准备 GitHub 推送后的自动构建和个人构建更新提示。目标浏览器为 Chrome/Edge，当前安装方式为加载已解压扩展；服务器部署方式尚未确定。本阶段完成无需服务器参数即可验证的代码准备，并向用户提供配置和手动更新步骤。

## 已确认约束

- 保留原项目 `package.json` 的版本号 `2.8.8`，另设个人构建号。
- 管理页和弹窗打开时检查；只提示并提供下载入口，不自动安装。
- 现有“立即升级”按钮暂不处理。
- 构建号未递增时，仍可上传新代码，但插件不显示更新提示。
- 遇到超出已确认假设的新情况，先询问用户。

## 当前状态与下一步

- 已完成仓库和现有更新钩子的只读核对；静态 `latest.json` 方案已获用户口头认可。
- 书面设计见 `docs/superpowers/specs/2026-10-15-personal-release-design.md`，ExecPlan 见 `plans/2026-10-15-personal-release.md`，均已获用户审阅通过；用户选择直接在当前 `master` 目录实施。
- 已增加独立个人构建号、清单校验与下载提示、发布脚本和 `master` 推送工作流。当前工作区改动尚未提交或推送；GitHub Actions 尚未在远端实际运行。
- 待确认：服务器系统、IP/域名、目标绝对目录、传输协议和公开 HTTPS 地址。没有这些信息时不能验证实际服务器传输。
- 下一步：用户准备服务器的系统、IP/域名、绝对目录、传输协议及公开 HTTPS URL 后，按 `docs/deployment/release.md` 接入部署步骤并验证。届时设置仓库变量并重新构建、手动安装一次配置了地址的扩展。Chrome/Edge 的管理页及弹窗手动验证仍需在真实浏览器中完成。

## 验证记录

- **已通过：** `pnpm test:release`（9 项）；`pnpm compile`；`pnpm lint:no-fix`；`pnpm build`；`pnpm zip`；`pnpm build:firefox`；`pnpm convert:guide`。发布脚本检查 ZIP 根目录、清单与构建号，再生成含 SHA-256 的 `latest.json`；实测本地 WXT ZIP 通过，损坏、嵌套、过期与 Firefox 包被拒绝。使用示例 `WXT_UPDATE_MANIFEST_URL` 构建时，Chromium 产物包含该 URL，Firefox 产物不含该 URL。
- **已知环境限制：** WXT 构建在当前受限沙箱中可能因子进程 `spawn EPERM` 失败；在获准的运行环境下构建与 ZIP 打包通过。Node 的 `--test` 子进程模式同样受限，测试改由 `node --experimental-strip-types tests/release.test.mjs` 直接执行。
- **未运行：** GitHub 远端工作流、Chrome/Edge 真实浏览器界面及重载检查、服务器传输测试。服务器参数尚未提供。
