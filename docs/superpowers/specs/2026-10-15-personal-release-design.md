# NiceTab 个人构建发布与更新提示设计

日期：2026-10-15
状态：已获用户书面设计审阅通过；代码端已实施，服务器传输待参数

## 目的与范围

用户在 Chrome/Edge 中通过“加载已解压扩展”使用自己的 NiceTab 改版。推送 `master` 后，应自动验证、编译并产出可下载的 Chromium 扩展包。待用户准备好服务器后，发布流程把包和静态版本清单放入指定目录。管理页与弹窗打开时检查远端清单，有更高的个人构建号时提供下载入口。扩展不会安装或替换本地文件。

本次代码准备可以完成构建、打包、元数据生成、客户端检查及 GitHub Actions 工件上传。服务器系统、传输协议、地址、目录和 HTTPS URL 尚未提供，因此实际向指定 IP 传送文件不在本次可验证范围内；发布接口应保持数据文件与部署步骤分离，待连接方式确定后接上，不猜测服务器能力。

## 选择的方案

采用静态 `latest.json`。这只要求服务器托管静态文件，客户端也只访问固定 URL。备选的 GitHub Release API 会增加 GitHub 发布与 API 依赖；浏览器原生更新不适用于当前已解压安装方式。保留 `entrypoints/common/hooks/update.ts` 和管理页现有“立即升级”行为。

## 文件契约

仓库新增 `public/release.json`，由协助用户修改代码的 AI 在需要显示新构建时递增正整数 `build`；WXT 将它随 Chromium 扩展打包。该数字独立于 `package.json` 的原项目版本。初值为 `1`。

```json
{"build": 1}
```

每次成功构建产生一个带提交 SHA 的 ZIP 文件及供服务器托管的 `latest.json`。清单格式固定为以下 JSON 对象；`archive` 是与 `latest.json` 同目录的文件名，避免写入未经验证的外部下载地址。

```json
{
  "schema": 1,
  "build": 1,
  "archive": "nice-tab-1-<commit-sha>.zip",
  "sha256": "<64 个十六进制字符>",
  "commit": "<40 位 Git 提交 SHA>"
}
```

尖括号字段表示生成脚本根据实际构建填写的值，不是需要手工提交的值。GitHub Actions 的仓库变量提供清单的公开 HTTPS URL，构建时写入 `WXT_UPDATE_MANIFEST_URL`；未配置时客户端不发网络请求，也不显示提示。包和清单上传服务器时必须先上传包、最后替换 `latest.json`。若上传过程失败，服务器应继续指向上一次完整包。

## 构建与发布数据流

1. `master` 的每次推送触发工作流，使用锁文件安装依赖，运行类型检查、无修复 lint 和 Chromium 构建。
2. 打包 `.output/chrome-mv3` 的内容，确保 ZIP 根目录有 `manifest.json`，计算 SHA-256，生成 `latest.json`。
3. 将 ZIP 和清单保存为 GitHub Actions 工件，供没有服务器参数时下载和审阅。
4. 服务器准备好后，按用户确认的传输协议添加部署步骤。部署目标必须能让插件经 HTTPS 读取 `latest.json` 和 ZIP。传输凭据只放在 GitHub Secrets 中。
5. 同一个 `build` 可由不同提交生成不同包。按用户决定，仍允许发布，但已安装相同或更高 `build` 的插件不显示新构建提示。

## 客户端行为

共享模块负责读取本地 `release.json`、请求远端 `latest.json`、验证 JSON 形状与构建号，并只在 `remote.build > local.build` 时返回更新信息。下载地址由已配置的 HTTPS 清单 URL 与 `archive` 文件名拼接，必须仍为同源 HTTPS 地址。请求设置超时与禁止缓存，网络失败、空配置或无效清单不影响原有功能。

管理页和弹窗分别在打开时调用共享钩子，显示个人构建号和下载入口；紧凑弹窗也能看到提示。提示文案有中英文版本。原有浏览器更新事件、`runtime.reload()` 按钮以及标签页数据存储均不改。本功能以 Chromium 产物为目标；Firefox 构建不显示指向 Chromium ZIP 的下载提示。

## 验证与交接

- 纯逻辑测试覆盖构建号比较、相同号不同提交、无效 JSON、非 HTTPS 或跨源下载路径、请求失败。
- 跑 `pnpm compile`、`pnpm lint:no-fix`、`pnpm build`；检查输出包内含 `release.json` 且 ZIP 根目录正确。
- 如可控制浏览器，加载本地 Chromium 构建并在管理页与弹窗分别检查“较大构建号”“相同构建号”“远端不可达”。
- 更新 `docs/deployment/release.md`，写明 GitHub 变量、Secrets、服务器准备步骤和已解压扩展的手动替换与重载流程。实际传输验证要等用户提供服务器信息。

## 恢复与安全边界

CI 失败不得更新服务器的 `latest.json`。客户端只解析元数据，不执行远端代码、不自动安装。用户更新时保持原扩展加载目录，以便沿用当前安装实例；先备份目录内容，再用新 ZIP 的内容替换，最后在扩展管理页重载。
