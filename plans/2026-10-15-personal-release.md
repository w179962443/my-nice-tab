# NiceTab Personal Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每次推送 `master` 自动产出 Chromium ZIP 与静态发布清单，并在管理页、弹窗提示较新的个人构建。

**Architecture:** `public/release.json` 是随包携带的个人构建号；CI 生成 ZIP 和 `latest.json`，先保存为 GitHub Actions 工件。共享纯逻辑模块校验清单，两个扩展界面复用检查钩子和提示组件。服务器传输步骤等用户提供协议与地址后接入。

**Tech Stack:** WXT、React、TypeScript、Node.js 22.16+ 内置测试器、pnpm 10.31.0、GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-10-15-personal-release-design.md`

## Global Constraints

- `package.json` 的原项目版本 `2.8.8` 不作为个人构建比较依据；初始 `public/release.json` 为 `{"build":1}`。
- 仅远端 `build` 大于本地 `build` 时提示；相同构建号的不同提交仍可发布，不提示。
- 保留 `entrypoints/common/hooks/update.ts` 的浏览器更新事件与现有“立即升级”按钮。
- Chromium 产物使用一个 ZIP；Firefox 界面不得指向 Chromium ZIP。
- 无 `WXT_UPDATE_MANIFEST_URL` 时不请求网络；配置的清单 URL 和构建出的下载 URL 必须同源 HTTPS。
- 服务器系统、传输协议、IP、目录、HTTPS URL 未提供；本轮不猜测远程传输实现。不得把密钥写入仓库。
- 不改变 `entrypoints/common/storage/` 的数据契约，也不增改清单权限。

## Review Focus

1. `WXT_UPDATE_MANIFEST_URL` 为空：不发请求，也不显示错误或提示（任务 2 的检查测试）。
2. 相同构建号但提交不同：不显示更新（任务 1 的比较测试）。
3. 远端 `archive` 含路径穿越、外部 URL 或与清单构建号不符：拒绝链接（任务 1 的校验测试）。
4. 网络超时或清单 404：管理页和弹窗继续正常显示（任务 2 的请求测试和手动检查）。
5. Firefox 产物：不显示 Chromium 下载入口（任务 2 的构建检查）。

---

## Purpose

让用户推送源码后拿到可解压的 Chromium 扩展包，并用独立构建号控制插件内下载提示。本计划只做无需服务器参数即可验证的代码准备；实际服务器连接是后续明确的集成步骤。

## Context

- `entrypoints/options/App.tsx` 已有浏览器原生更新事件提示。
- `entrypoints/popup/App.tsx` 有原项目版本显示，且同时有紧凑与展开布局。
- `entrypoints/common/hooks/`、`entrypoints/common/components/` 适合放共享检查与提示。
- `entrypoints/common/locale/modules/common/` 提供中英文文案。
- `public/` 的静态文件由 WXT 原样放入输出；`wxt.config.ts` 的 Firefox 分支和现有 `<all_urls>` 权限不改。
- `docs/deployment/release.md`、`GUIDE-zh.md` 负责构建、手动安装和界面行为说明。

## Risks

- 服务器未就绪时，CI 工件可用，但远程 `latest.json` 不可访问，插件不会提示。
- ZIP 若多一层目录，Chrome 无法直接按说明解压为已加载扩展；需要检查 ZIP 根目录。
- 相同构建号的不同提交会使下载文件变化却没有提示，这是用户明确选择的规则。
- Firefox 构建共用 UI 代码，必须屏蔽 Chromium 专用提示。
- 修改 `GUIDE-zh.md` 后必须运行转换脚本；`public/docs/` 被忽略，需核对生成结果。

## Plan

### Task 1: 个人构建清单契约

**Files:**
- Create: `public/release.json`
- Create: `entrypoints/common/release/manifest.ts`
- Create: `tests/release-manifest.test.mjs`
- Modify: `package.json`（增加 `test:release`，不改变原项目版本）

**Interfaces:**
- `type AvailableRelease = { build: number; downloadUrl: string; sha256: string }`：由清单模块导出并供钩子、组件使用。
- `parseLocalRelease(value: unknown): { build: number } | null`：只接受正安全整数。
- `resolveAvailableRelease(local: unknown, remote: unknown, manifestUrl: string): AvailableRelease | null`：验证 `schema: 1`、构建号、40 位十六进制 `commit`、64 位十六进制 `sha256`、`nice-tab-<build>-<commit>.zip` 形式的单一文件名；只在远端更高时返回同源 HTTPS URL。

- [x] 写 `tests/release-manifest.test.mjs`：断言较大构建号返回下载 URL，相同构建号不同提交返回 `null`，无效构建号、路径穿越、外部 URL、构建号与文件名不一致均返回 `null`。
- [x] 运行测试，确认因目标模块缺失而失败；当前环境的 Node `--test` 子进程模式触发 `spawn EPERM`，改用直接执行测试入口。
- [x] 创建 `public/release.json` 和 `manifest.ts`，实现上述两个接口，不接触存储或现有浏览器更新钩子。
- [x] 再运行 `pnpm test:release`，确认测试通过；`pnpm compile` 通过。

### Task 2: 管理页和弹窗的共享检查与提示

**Files:**
- Create: `entrypoints/common/release/check.ts`
- Create: `entrypoints/common/hooks/usePersonalRelease.ts`
- Create: `entrypoints/common/components/PersonalReleaseNotice.tsx`
- Create: `tests/release-check.test.mjs`
- Modify: `entrypoints/options/App.tsx`、`entrypoints/popup/App.tsx`
- Modify: `entrypoints/common/locale/modules/common/zhCN.ts`、`enUS.ts`

**Interfaces:**
- `checkPersonalRelease(manifestUrl: string, localReleaseUrl: string, fetcher: typeof fetch): Promise<AvailableRelease | null>`：空或非 HTTPS 配置直接返回 `null`；请求限时 5 秒并禁用缓存；网络/HTTP/JSON 错误返回 `null`；内部调用任务 1 的解析接口。
- `usePersonalRelease(): AvailableRelease | null`：在界面挂载时运行一次；Firefox 或空配置直接返回 `null`。
- `PersonalReleaseNotice`：读取钩子结果，显示新构建号与下载链接；两个界面复用；不调用 `runtime.reload()`。

- [x] 先写 `tests/release-check.test.mjs`，断言空 URL 不调用 `fetcher`，404、拒绝请求、超时及无效 JSON 返回 `null`，有效响应使用 `cache: 'no-store'` 并返回任务 1 的结果。
- [x] 运行测试，确认因检查模块缺失而失败。
- [x] 实现 `check.ts`，重跑测试至通过。
- [x] 实现钩子、提示组件和中英文文案；在管理页原有更新提示旁与弹窗紧凑/展开布局中显示，Firefox 编译目标不请求 Chromium 清单。
- [ ] `pnpm compile` 和 `pnpm lint:no-fix` 已通过；真实浏览器两界面与原按钮的手动检查未运行。

### Task 3: 构建工件和静态元数据

**Files:**
- Create: `scripts/prepare-release.mjs`
- Create: `tests/prepare-release.test.mjs`
- Create: `.github/workflows/build-extension.yml`
- Modify: `package.json`（脚本如需增加，复用任务 1 的修改）

**Interfaces:**
- `prepareRelease({ releaseFile, buildDir, zipDir, outputDir, commit }): { archivePath: string; manifestPath: string }`：读取传入的 `public/release.json` 路径，检查构建目录根部的 `manifest.json` 与 `release.json`，要求 `zipDir` 中恰有一个 WXT ZIP，将其复制为 `nice-tab-<build>-<40 位 SHA>.zip`，计算 SHA-256 并输出 `latest.json`。输入缺失或 ZIP 不唯一时失败。
- 工作流在 `master` 推送时用 Node 22.16+、仓库指定 pnpm 和锁文件安装，依次运行 `pnpm test:release`、`pnpm compile`、`pnpm lint:no-fix`、`pnpm build` 与打包；以仓库变量 `NICETAB_UPDATE_MANIFEST_URL` 设置构建时 `WXT_UPDATE_MANIFEST_URL`；上传 ZIP 和 `latest.json` 为 GitHub Actions 工件，权限仅 `contents: read`。

- [x] 先写 `tests/prepare-release.test.mjs`，断言文件命名、SHA-256、JSON 字段以及缺少/无效构建文件时报错。
- [x] 运行测试，确认因脚本缺失而失败。
- [x] 实现脚本，重跑测试至通过。
- [x] 实现工作流，执行本地 `pnpm build` 与 `pnpm zip`，运行脚本并检查 ZIP 根目录包含 `manifest.json`、`release.json`。
- [ ] 工作流已编写且空服务器变量的客户端路径经单元测试覆盖；GitHub 远端工件尚未实际运行验证。

### Task 4: 使用文档与最终验证

**Files:**
- Modify: `docs/deployment/release.md`、`GUIDE-zh.md`
- Modify: `docs/project-context.md`、`docs/decisions.md`、本计划进度与验证记录
- Generated for local QA: `public/docs/`（按现有忽略规则处理）

- [x] 更新部署文档：GitHub 变量含义、构建工件下载、未来服务器必须提供的信息、ZIP 替换原目录与浏览器重载步骤，并明确相同构建号不提示。
- [x] 更新用户指南中管理页与弹窗的个人构建提示说明，运行 `pnpm convert:guide`，核对生成 HTML。
- [ ] `pnpm test:release`、`pnpm compile`、`pnpm lint:no-fix`、`pnpm build`、`pnpm build:firefox` 均通过；Chrome/Edge 手动重载检查未运行。
- [x] 记录每项验证的通过、失败或未运行，以及服务器传输尚待外部信息的事实，更新项目上下文与决策状态。

## Milestones

1. 纯逻辑契约和错误输入测试通过。
2. 管理页、弹窗显示个人构建下载入口，且不改变原浏览器更新提示。
3. `master` 推送可得到带清单的 GitHub Actions 工件。
4. 文档与验证记录足够让用户配置服务器并手动更新已解压扩展。

## Progress

- [x] 仓库结构、原有更新流程和用户约束核对
- [x] 书面设计获用户审阅通过
- [x] 实施计划获用户审阅通过；用户选择当前任务顺序实施
- [x] Task 1 完成
- [x] Task 2 代码完成，真实浏览器检查待运行
- [x] Task 3 代码完成，GitHub 远端工作流待推送验证
- [x] Task 4 文档与本地验证完成，真实浏览器检查待运行

## Decision Log

- 2026-10-15：采用静态 `latest.json`；构建号独立于原项目版本；同号新提交仍可发布但不提示。
- 2026-10-15：服务器信息缺失，先交付 GitHub Actions 工件、静态清单及客户端检查；传输协议确定后再接部署步骤。
- 2026-10-15：用户选择直接在当前 `master` 目录实施；没有另建 worktree。

## Discoveries

- 现有 `useUpdate` 只监听 `browser.runtime.onUpdateAvailable`，按钮调用 `browser.runtime.reload()`。
- WXT 的 `public/` 文件原样复制到输出；Node 22.16.0 在当前机器支持 `--experimental-strip-types`，可不新增测试依赖。
- 本仓库目前没有 `.github/workflows`；`pnpm build` 的 Chromium 输出是 `.output/chrome-mv3`。
- 当前 Windows 受限沙箱对 WXT 再次构建时的子进程操作返回 `spawn EPERM`；在获准运行环境中 `pnpm zip`、配置 URL 的 Chromium 构建和 Firefox 构建成功。测试由直接执行 Node 测试入口绕开 `--test` 子进程限制。

## Validation

通过：`pnpm test:release`（9 项）、`pnpm compile`、`pnpm lint:no-fix`、`pnpm build`、`pnpm zip`、`pnpm build:firefox`、`pnpm convert:guide`。发布脚本校验 ZIP 根目录、Chromium 清单与个人构建号；实测本地 ZIP 通过，损坏、嵌套、过期与 Firefox 包被拒绝，再生成实际 SHA-256 和清单。带示例 URL 的 Chromium 构建包含该 URL，Firefox 构建不含它。未运行：真实 Chrome/Edge 管理页与弹窗手动检查、GitHub 远端工作流、服务器传输测试；最后一项缺少目标参数。

## Recovery

本轮无存储迁移。构建或打包失败时不生成可发布的 `latest.json` 工件；服务器接入时必须先上传 ZIP、最后更新静态清单。若中途停止，依据本计划 Progress 和 `docs/project-context.md` 继续；保留用户当前加载的扩展目录并备份后再替换。

## Retrospective

代码端交付了静态发布清单、共享下载提示、发布脚本、GitHub Actions 工作流及操作文档；原浏览器更新钩子、存储契约和原项目版本未改。浏览器手动检查与远端工作流必须在对应环境执行，服务器传输需用户补充目标参数后接入。
