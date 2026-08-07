# GitHub Sync 同步机制详解

> 本文档详细描述 NiceTab 浏览器扩展中基于 GitHub/Gitee Gist 的远程同步机制的实现细节，涵盖配置体系、Push/Pull 完整流程、三层合并策略、自动同步调度及错误处理。

---

## 目录

1. [架构概览](#1-架构概览)
2. [配置与存储体系](#2-配置与存储体系)
3. [认证方式](#3-认证方式)
4. [Push/Pull 完整流程](#4-pushpull-完整流程)
5. [合并策略详解](#5-合并策略详解)
6. [自动同步调度](#6-自动同步调度)
7. [错误处理与容错](#7-错误处理与容错)
8. [关键文件索引](#8-关键文件索引)

---

## 1. 架构概览

### 1.1 组件关系图

```
┌──────────────────────────────────────────────────────────────┐
│                        UI Layer                               │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ Popup App    │  │  Options/Sync  │  │  Context Menus   │  │
│  │ (触发同步)    │  │  (配置+历史)    │  │  (右键触发同步)   │  │
│  └──────┬───────┘  └───────┬────────┘  └────────┬─────────┘  │
│         │                  │                     │            │
│         └──────────────────┼─────────────────────┘            │
│                            │ eventEmitter / runtimeMessage    │
├────────────────────────────┼─────────────────────────────────┤
│                   Storage Layer                               │
│  ┌─────────────────────────┴──────────────────────────────┐  │
│  │                    SyncUtils                            │  │
│  │  ┌──────────┐  ┌────────────┐  ┌───────────────────┐   │  │
│  │  │ Config   │  │ Sync Logic │  │ Merge Strategy    │   │  │
│  │  │ Manager  │  │ (8 modes)  │  │ (3-level merge)   │   │  │
│  │  └──────────┘  └────────────┘  └───────────────────┘   │  │
│  └─────────────────────────┬──────────────────────────────┘  │
│                            │ fetchApi()                       │
├────────────────────────────┼─────────────────────────────────┤
│                    Network Layer                              │
│  ┌─────────────────────────┴──────────────────────────────┐  │
│  │  GitHub Gist API          Gitee Gist API                │  │
│  │  api.github.com/gists     gitee.com/api/v5/gists        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   Background (Service Worker)                 │
│  ┌──────────────────────┐    ┌──────────────────────────┐    │
│  │  AutoSyncAlarm       │───▶│  onAutoSyncAlarm()       │    │
│  │  (chrome.alarms)     │    │  - 检查时间窗口            │    │
│  │  periodInMinutes     │    │  - 检查启用状态            │    │
│  └──────────────────────┘    │  - 调用 syncStart()       │    │
│                               └──────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 设计原则

- **双通道并行**：Gist（GitHub/Gitee）和 WebDAV 是两套结构平行、互不干扰的同步通道
- **双远端支持**：同一套 Gist 同步逻辑同时支持 GitHub 和 Gitee，各自独立配置
- **本地优先**：合并时本地数据作为基础，远程数据补充；自动同步相关配置始终以本地为准
- **乐观并发**：同一远端同一时间只允许一个同步操作（通过 `syncStatus` 互斥锁）

---

## 2. 配置与存储体系

### 2.1 存储键一览

| 存储键 | 类型 | 说明 |
|--------|------|------|
| `local:syncConfig` | `SyncConfigProps` | GitHub + Gitee 的 token、gistId、filename、autoSync |
| `local:syncResult` | `SyncResultProps` | 每个远端最近 50 条同步记录 |
| `local:syncStatus` | `SyncStatusProps` | 每个远端的当前状态（`idle` / `syncing`） |
| `local:settings` | `SettingsProps` | 全局设置，包含 6 个同步相关字段（见 2.3） |

### 2.2 Gist 配置结构

```typescript
// local:syncConfig 的数据结构
{
  github: {
    accessToken: string;   // Personal Access Token
    gistId: string;        // 缓存的 Gist ID，避免每次列表查询
    filename: string;      // Gist description，用于定位（默认 "__NiceTab_gist_key__"）
    autoSync: boolean;     // 该远端是否参与自动同步
  },
  gitee: {
    // 同上，独立配置
  }
}
```

**配置变更时的副作用**：
- 修改 `accessToken` 或 `filename` → 清空 `gistId` + 清空该远端的同步历史记录
- 这样做是为了防止 token 更换后，旧的 gistId 指向无权限访问的 Gist

### 2.3 全局自动同步设置（存储在 `local:settings` 中）

| 设置键 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `autoSync` | `boolean` | `false` | 全局自动同步开关 |
| `autoSyncType` | `AutoSyncType` | `"auto-push-merge"` | 自动同步模式 |
| `autoSyncInterval` | `number` | `30` | 间隔数值 |
| `autoSyncTimeUnit` | `"m" \| "h"` | `"m"` | 间隔单位（分钟/小时） |
| `autoSyncTimeRanges` | `[string, string][]` | `[["00:00","23:59"]]` | 允许同步的时间窗口 |
| `remoteSyncWithSettings` | `boolean` | - | 设置数据是否随标签页一起同步 |

### 2.4 同步结果记录

```typescript
// 单条同步结果
{
  syncTime: string;    // 同步时间 "YYYY-MM-DD HH:mm:ss"（使用本地时间）
  syncType: SyncType;  // 8 种同步类型之一
  syncResult: "success" | "failed";
  reason?: string;     // 失败原因（国际化文案 key）
}
```

> **注意**：同步时间使用本地时间而非 API 返回的 `updated_at`，因为 Gitee 的 `updated_at` 有时不会更新。

---

## 3. 认证方式

### 3.1 Token 管理

- 用户手动在 Options 页面的同步配置抽屉中输入 **Personal Access Token**
- Token 明文存储在 `local:syncConfig` 中
- 每次 API 请求携带 Header：`Authorization: token <accessToken>`
- GitHub Token 需要 `gist` 权限；Gitee Token 需要 `gists` 权限

### 3.2 Token 配置入口

| 平台 | Token 设置页面 |
|------|---------------|
| GitHub | `https://github.com/settings/tokens` |
| Gitee | `https://gitee.com/profile/personal_access_tokens` |

### 3.3 安全特性

- 无 OAuth 流程（纯 PAT 方式）
- 无第三方 SDK 依赖（不依赖 octokit），直接使用 `fetch` + REST API
- CSP 策略显式限制只能请求 `https://api.github.com` 和 `https://gitee.com`

---

## 4. Push/Pull 完整流程

### 4.1 入口函数 `syncStart()`

```
syncStart(remoteType, syncType)
│
├─ [1] 前置检查
│   ├─ accessToken 为空？ → return（静默退出）
│   └─ syncStatus === 'syncing'？ → return（互斥锁，防止并发）
│
├─ [2] 设置状态为 'syncing'
│   └─ setSyncStatus(remoteType, 'syncing')
│       ├─ 写入 local:syncStatus
│       ├─ eventEmitter.emit('sync:sync-status-change--gist')
│       └─ runtime.sendMessage({ msgType: 'sync:sync-status-change--gist' })
│
├─ [3] try-catch 主流程
│   │
│   ├─ 有 gistId 缓存？
│   │   ├─ YES → getGistById(remoteType)  [GET /gists/{id}]
│   │   │   ├─ 成功 → handleBySyncType()
│   │   │   └─ 失败 → 进入 handleWholeProcess()
│   │   │
│   │   └─ NO → handleWholeProcess()
│   │       ├─ getGistsList(remoteType)  [GET /gists]
│   │       ├─ 按 description 匹配 gist
│   │       ├─ 找到？
│   │       │   ├─ YES → 保存 gistId → getGistById() → handleBySyncType()
│   │       │   └─ NO  → createGist(remoteType)  [POST /gists]
│   │       │            └─ 保存新 gistId → handleSyncResult()
│   │
│   └─ catch(error) → handleSyncResult(FAILED, errorMessage)
│
└─ [4] 恢复状态为 'idle'
    └─ setSyncStatus(remoteType, 'idle')
```

### 4.2 Gist 定位逻辑

**为什么需要 `handleWholeProcess`？**

1. **GitHub API 限制**：GitHub 的 `GET /gists` 列表接口**不返回文件内容**（Gitee 返回），因此即使列表中匹配到了 gist，也必须再通过 `GET /gists/{id}` 获取完整内容
2. **缓存容错**：缓存了 `gistId` 后优先直取，失败时回退到全量列表查找（应对 gist 被手动删除的情况）

**匹配规则**：

```
gist.description === (config[remoteType].filename || '__NiceTab_gist_key__')
```

### 4.3 八种同步模式详解

同步类型命名规范：`{触发方式}-{方向}-{合并策略}`

| 同步类型 | 触发方式 | 方向 | 合并策略 | 流程说明 |
|----------|---------|------|---------|---------|
| `manual-push-force` | 手动 | ↑ 上传 | 强制覆盖 | 直接用本地数据 PATCH 远端 → 记录结果 |
| `auto-push-force` | 自动 | ↑ 上传 | 强制覆盖 | 同上 |
| `manual-pull-force` | 手动 | ↓ 下载 | 强制覆盖 | GET 远端 → `clearAll()` 清空本地 → `importTags(remote, 'merge')` |
| `auto-pull-force` | 自动 | ↓ 下载 | 强制覆盖 | 同上 |
| `manual-push-merge` | 手动 | ↑↓ 双向 | 合并 | GET 远端 → 三层合并 → 写本地 → PATCH 远端 |
| `auto-push-merge` | 自动 | ↑↓ 双向 | 合并 | 同上 |
| `manual-pull-merge` | 手动 | ↓ 下载 | 合并 | GET 远端 → 三层合并 → 写本地（不上传） |
| `auto-pull-merge` | 自动 | ↓ 下载 | 合并 | 同上 |

### 4.4 `handleBySyncType()` 分发逻辑

```
handleBySyncType(remoteType, syncType, gistData)
│
├─ gistData.id 为空？ → handleSyncResult(FAILED) → return
│
├─ syncType 是 PUSH_FORCE（manual 或 auto）？
│   └─ YES → updateGist(remoteType)  [PATCH /gists/{id}]
│       └─ 直接用本地 exportTags() + 可选 settings 覆盖远端
│
├─ syncType 是其他模式（MERGE 或 PULL_FORCE）？
│   │
│   ├─ [A] 读取远端文件内容
│   │   ├─ 优先从 files[filename].content 读取
│   │   ├─ 如果 truncated = true 且 size ≤ 10MB → 通过 raw_url 获取
│   │   └─ 如果 truncated = true 且 size > 10MB → 拒绝合并，记录失败
│   │
│   ├─ [B] syncType 是 PULL_FORCE？
│   │   └─ YES → tabListUtils.clearAll()  清空本地全部数据
│   │
│   ├─ [C] 处理设置文件（如果存在且 remoteSyncWithSettings 开启）
│   │   ├─ PUSH_MERGE 模式：
│   │   │   └─ settings = { ...localSettings, ...omit(remoteSettings, syncExcludedSettingsProps) }
│   │   │      （本地设置为基础，远端覆盖非排除字段）
│   │   └─ 其他模式：
│   │       └─ settings = remoteSettings（直接使用远端设置）
│   │   └─ 应用 settings + 发送语言切换消息
│   │
│   ├─ [D] 解析标签页数据
│   │   └─ extContentImporter.niceTab(fileContent)  解析 JSON → TagItem[]
│   │       ├─ 为每个 tag/group/tab 重新生成 ID
│   │       └─ 过滤 data:image/ 开头的 favIconUrl
│   │
│   └─ [E] 按 syncType 决定最终操作
│       ├─ PUSH_MERGE（manual 或 auto）：
│       │   ├─ 获取本地 tagList
│       │   ├─ mergeLocalAndRemoteTags(localTagList, remoteTagList)
│       │   ├─ setTagList(mergedTagList)  写入本地
│       │   └─ updateGist(remoteType)     推送合并结果到远端
│       │
│       └─ PULL_MERGE（manual 或 auto）：
│           ├─ importTags(remoteTagList, 'merge')  仅合并到本地
│           └─ 不上传远端
│
└─ handleSyncResult() → reloadOtherAdminPage()
```

### 4.5 Gist API 操作

| 操作 | HTTP 方法 | 端点 | 说明 |
|------|-----------|------|------|
| 列出所有 Gist | `GET` | `/gists` | GitHub 不返回文件内容 |
| 获取单个 Gist | `GET` | `/gists/{id}` | 返回完整文件内容 |
| 创建 Gist | `POST` | `/gists` | body: `{description, files: {name: {content}}}` |
| 更新 Gist | `PATCH` | `/gists/{id}` | body: `{description, files: {name: {content}}}` |

### 4.6 数据序列化

**上传前的处理（`getApiParams()`）**：

```
exportTags() → JSON.stringify → sanitizeContent() → Gist API
settings     → JSON.stringify → Gist API（可选）
```

`sanitizeContent()` 执行三层过滤：
1. `filterEmoji()` — 过滤 emoji 字符（Gist API title 不接受 emoji）
2. `filter4ByteChars()` — 过滤 4 字节 UTF-8 字符（补充平面字符）
3. `filterMySQLSpecialChars()` — 过滤 MySQL 特殊字符（NULL 字节、控制字符）

**下载后的处理**：

```
Gist API → JSON.parse → extContentImporter.niceTab()
  ├─ 重新生成所有 tagId / groupId / tabId（使用 getRandomId()）
  ├─ 重新生成 createTime（保留原有时间或使用当前时间）
  └─ 过滤 data:image/ 开头的 favIconUrl
```

### 4.7 内容截断处理

GitHub Gist API 对超过 **10MB** 的文件会设置 `truncated: true` 且不返回 `content` 字段。处理逻辑：

```
if (fileInfo.truncated && fileInfo.raw_url) {
  if (fileInfo.size > 10 * 1024 * 1024) {
    // 拒绝合并，保护本地数据不被损坏
    → handleSyncResult(FAILED, "sync.reason.contentTooLarge")
    → return（不执行任何合并或写入操作）
  }
  // 文件 ≤ 10MB，通过 raw_url 获取完整内容
  fileContent = await fetchApi(fileInfo.raw_url, {}, {}, 'text')
}
```

---

## 5. 合并策略详解

合并策略是同步机制的核心，采用 **三层逐级合并** 的方式，层级从高到低依次是：**Tag（标签分类）→ Group（标签组）→ Tab（标签页）**。

### 5.1 数据结构

```
TagItem                         // 标签分类（如"工作"、"学习"）
├── tagId: string
├── tagName: string             // 合并键 ✓
├── static: boolean             // 是否为静态标签（中转站）
├── createTime: string
└── groupList: GroupItem[]      // 标签组列表
    ├── groupId: string
    ├── groupName: string       // 合并键 ✓
    ├── createTime: string
    └── tabList: TabItem[]      // 标签页列表
        ├── tabId: string
        ├── title: string
        └── url: string         // 去重键 ✓
```

### 5.2 第一层：Tag（标签分类）合并

**入口函数**：`mergeLocalAndRemoteTags(localTagList, remoteTagList)`

```
算法步骤：
1. 分别对 localTagList 和 remoteTagList 执行 getMergedTagMap()
   → 将内部的同名 group 预先合并

2. 收集所有 tagName（本地 + 远端）去重

3. 对每个 tagName：
   ├─ 本地和远端都存在 → 合并两者的 groupList
   │   └─ mergeGroupList(localTag.groupList, remoteTag.groupList)
   ├─ 仅本地存在 → 保留本地 tag（groupList 已自合并）
   └─ 仅远端存在 → 保留远端 tag（groupList 已自合并）

4. 排序：static = true 的标签排在最前面（中转站优先）
```

**关键代码**（[syncUtils.ts:378-408](entrypoints/common/storage/syncUtils.ts#L378-L408)）：

```typescript
mergeLocalAndRemoteTags(localTagList, remoteTagList) {
  const localTagMap = this.getMergedTagMap(localTagList);
  const remoteTagMap = this.getMergedTagMap(remoteTagList);
  const tagNameSet = new Set<TagItem['tagName']>();

  localTagList.forEach(tag => tagNameSet.add(tag.tagName));
  remoteTagList.forEach(tag => tagNameSet.add(tag.tagName));

  return [...tagNameSet]
    .reduce<TagItem[]>((result, tagName) => {
      const localTag = localTagMap.get(tagName);
      const remoteTag = remoteTagMap.get(tagName);
      if (localTag && remoteTag) {
        // 双方都有 → 合并 groupList
        return [...result, {
          ...localTag,
          groupList: this.mergeGroupList(localTag.groupList, remoteTag.groupList),
        }];
      }
      const tag = localTag || remoteTag;
      return tag ? [...result, tag] : result;
    }, [])
    .sort((a, b) => {
      if (!!a.static === !!b.static) return 0;
      return a.static ? -1 : 1;  // static 标签排在最前
    });
}
```

### 5.3 第二层：Group（标签组）合并

**入口函数**：`mergeGroupList(localGroupList, remoteGroupList)`

```
算法步骤：
1. 创建 groupMap: Map<groupName, GroupItem>

2. 遍历 localGroupList：
   ├─ groupName 已存在于 map？
   │   ├─ YES → mergeSameNameGroup(mapGroup, localGroup)
   │   └─ NO  → 直接放入 map
   └─ 注意：此步骤也会将同一本地 tag 下的同名 group 合并

3. 遍历 remoteGroupList：
   ├─ groupName 已存在于 map？
   │   ├─ YES → mergeSameNameGroup(mapGroup, remoteGroup)
   │   └─ NO  → 直接放入 map

4. 按 createTime 降序排序
   └─ sortGroupsByCreateTimeDesc(groupMap.values())
```

### 5.4 第三层：Tab（标签页）去重合并

**入口函数**：`mergeSameNameGroup(localGroup, remoteGroup)`

```
算法步骤：
1. 收集本地 group 中所有 tab 的 url → urlSet

2. 过滤远端 tabList：
   对每个 remoteTab：
   ├─ url 为空？ → 保留（允许无 URL 的 tab）
   ├─ url 已存在于 urlSet？ → 丢弃（本地优先）
   └─ url 不存在于 urlSet？ → 保留 + 加入 urlSet

3. 返回合并后的 group：
   { ...localGroup, tabList: [...localTabList, ...filteredRemoteTabList] }
```

**关键代码**（[syncUtils.ts:317-332](entrypoints/common/storage/syncUtils.ts#L317-L332)）：

```typescript
mergeSameNameGroup(localGroup, remoteGroup): GroupItem {
  const tabUrlSet = new Set(
    (localGroup.tabList || []).map(tab => tab.url).filter(Boolean),
  );
  const remoteTabList = (remoteGroup.tabList || []).filter(tab => {
    if (!tab.url) return true;               // 无 URL 的 tab 保留
    if (tabUrlSet.has(tab.url)) return false; // URL 重复 → 丢弃
    tabUrlSet.add(tab.url);
    return true;
  });

  return {
    ...localGroup,
    tabList: [...(localGroup.tabList || []), ...remoteTabList],
  };
}
```

**去重规则总结**：

| 场景 | 行为 |
|------|------|
| 远端 tab 的 URL 与本地完全相同 | **丢弃远端**，保留本地顺序 |
| 远端 tab 的 URL 在本地不存在 | **追加**到本地 tabList 末尾 |
| 远端 tab 无 URL（空值） | **保留**（不做去重判断） |
| 多个远端 tab 有相同 URL | 只保留第一个（后续被 urlSet 拦截） |

### 5.5 Group 排序规则

**入口函数**：`sortGroupsByCreateTimeDesc(groupList)`

排序使用 `sortKey`，优先级如下：

```
1. groupName 匹配模式 G_YYYYMMDD_HH:mm:ss_NNN
   → sortKey = "YYYYMMDDHHmmss" + NNN(补齐13位)
   示例："G_20240115_14:30:00_001" → "202401151430000000000000001"

2. createTime 存在
   → sortKey = createTime去除非数字字符 + 补齐14位 + "0000000000000"
   示例："2024-01-15 14:30:00" → "202401151430000000000000000"

3. 都不满足
   → sortKey = ""

排序规则：
  - sortKey 降序（b.localeCompare(a)）
  - sortKey 相同时按原始 index 升序（保持稳定排序）
```

### 5.6 Settings 合并规则

设置文件的合并有特殊处理，核心原则是 **本地自动同步配置不被远端覆盖**。

**PUSH_MERGE 模式**：

```typescript
settings = {
  ...localSettings,                                  // 本地设置为基础
  ...omit(remoteSettings, syncExcludedSettingsProps), // 远端覆盖非排除字段
};
```

**排除字段**（`syncExcludedSettingsProps`，[constants.ts:294-301](entrypoints/common/constants.ts#L294-L301)）：

- `remoteSyncWithSettings` — 远程同步时是否同步设置
- `autoSync` — 自动同步开关
- `autoSyncTimeUnit` — 自动同步时间单位
- `autoSyncInterval` — 自动同步间隔
- `autoSyncTimeRanges` — 自动同步时间窗口
- `autoSyncType` — 自动同步方式

**设计意图**：防止设备 A 的自动同步配置覆盖设备 B 的配置。例如：用户在办公室电脑设置每 30 分钟自动同步，在家用电脑设置每 6 小时自动同步，合并时各自保留自己的同步策略。

### 5.7 完整合并示例

```
初始状态：
  本地:
    Tag "工作"
      Group "G_20240115_14:30:00_001"
        Tab { url: "github.com", title: "GitHub" }
        Tab { url: "stackoverflow.com", title: "SO" }

  远端:
    Tag "工作"
      Group "G_20240115_14:30:00_001"
        Tab { url: "github.com", title: "GitHub" }    ← URL 重复
        Tab { url: "docs.google.com", title: "Docs" }  ← 新 tab
      Group "G_20240116_09:00:00_001"                   ← 新 group
        Tab { url: "figma.com", title: "Figma" }
    Tag "学习"                                           ← 新 tag
      Group "...": [...]

执行 PUSH_MERGE 后：
  本地（同时也是上传到远端的最终结果）:
    Tag "工作"
      Group "G_20240116_09:00:00_001"    ← 按 sortKey 降序排最前
        Tab { url: "figma.com", title: "Figma" }
      Group "G_20240115_14:30:00_001"
        Tab { url: "github.com", title: "GitHub" }     ← 保留本地
        Tab { url: "stackoverflow.com", title: "SO" }   ← 保留本地
        Tab { url: "docs.google.com", title: "Docs" }   ← 远端新增
    Tag "学习"                           ← 远端新增
      Group "...": [...]
```

---

## 6. 自动同步调度

### 6.1 Alarm 生命周期

```
浏览器启动
│
└─ background/index.ts
   └─ autoSyncAlarm.create()
      ├─ 读取 autoSync 开关
      ├─ 如果关闭 → clearAlarm()
      └─ 如果开启 → createAlarm({ periodInMinutes })

用户修改设置（autoSync/interval/timeUnit）
│
└─ initSettingsStorageListener()
   └─ autoSyncAlarm.checkReset(newSettings, oldSettings)
      └─ 相关字段变更 → reset()

Alarm 触发
│
└─ onAutoSyncAlarm(alarm)
   ├─ autoSync 关闭？ → clearAlarm() → return
   ├─ 当前时间不在任何 timeRange 内？ → return
   └─ 在时间窗口内 →
       ├─ syncUtils.autoSyncStart({ syncType })
       │   └─ 遍历 ['github', 'gitee']
       │       └─ per-remote autoSync 开启？ → syncStart()
       └─ syncWebDAVUtils.autoSyncStart({ syncType })
```

### 6.2 时间窗口判断

```typescript
// autoSyncTimeRanges 示例：[["09:00", "12:00"], ["14:00", "18:00"]]
const inRange = autoSyncTimeRanges.some(([start, end]) => {
  const startTime = dayjs(`${today} ${start}`, 'YYYY-MM-DD HH:mm');
  const endTime = dayjs(`${today} ${end}`, 'YYYY-MM-DD HH:mm');
  return startTime.isBefore(now) && endTime.isAfter(now);
});
```

### 6.3 双层开关控制

自动同步需要同时满足两个条件：

| 层级 | 开关 | 位置 |
|------|------|------|
| 全局 | `settings.autoSync = true` | 设置页 → 同步设置 |
| 单远端 | `syncConfig.{remote}.autoSync = true` | 同步页 → Gist 配置卡片 |

两者都开启时，该远端的自动同步才会实际执行。

---

## 7. 错误处理与容错

### 7.1 HTTP 层错误（`fetchApi`）

| 错误类型 | 检测方式 | 错误码 | 用户提示 |
|----------|---------|--------|---------|
| 超时 | 10 秒 timeout → AbortController.abort() | `ERROR:FETCH_TIMEOUT` | `common.timeout` |
| 中止 | `err.name === 'AbortError'` | `ERROR:FETCH_ABORTED` | `common.aborted` |
| 网络错误 | `TypeError` + `Failed to fetch` | `ERROR:FETCH_NETWORK_ERROR` | `common.networkError` |

### 7.2 业务层错误处理

| 场景 | 处理方式 |
|------|---------|
| 无 accessToken | `syncStart()` 静默返回，不执行任何操作 |
| 正在同步中 | `syncStatus === 'syncing'` 时拒绝新请求 |
| Gist 不存在 | 自动创建新 Gist |
| 缓存的 gistId 失效 | 回退到全量列表查找 |
| 文件超过 10MB | 拒绝合并，记录 `sync.reason.contentTooLarge` |
| API 返回异常 | catch 后记录失败结果，状态恢复为 idle |
| 远端无数据 | `gistData.id` 为空时记录失败 |

### 7.3 状态恢复保证

`syncStart()` 使用 `try-catch` 包裹主流程，无论成功或失败，最终都会恢复状态：

```typescript
try {
  // ... 主流程
} catch (error) {
  await this.handleSyncResult(remoteType, syncType, {} as GistResponseItemProps,
    this.formatErrorMsg(error.message, createdIntl));
}
// 这行代码始终会执行
this.setSyncStatus(remoteType, 'idle');
```

### 7.4 多窗口通知

同步完成后调用 `reloadOtherAdminPage()`，确保其他打开的 NiceTab 管理页面刷新数据。

---

## 8. 关键文件索引

| 文件 | 职责 |
|------|------|
| [entrypoints/common/storage/syncUtils.ts](entrypoints/common/storage/syncUtils.ts) | **核心**：SyncUtils 类，包含完整的 Gist 同步逻辑、合并算法 |
| [entrypoints/common/storage/syncWebDAVUtils.ts](entrypoints/common/storage/syncWebDAVUtils.ts) | WebDAV 并行实现（架构镜像） |
| [entrypoints/common/storage/index.ts](entrypoints/common/storage/index.ts) | 存储层初始化、所有 listener 注册 |
| [entrypoints/common/storage/tabListUtils.ts](entrypoints/common/storage/tabListUtils.ts) | 本地数据 CRUD：`exportTags()`、`importTags()`、`clearAll()`、`getTagList()`、`setTagList()` |
| [entrypoints/types/sync.ts](entrypoints/types/sync.ts) | 所有同步相关 TypeScript 类型定义 |
| [entrypoints/common/constants.ts](entrypoints/common/constants.ts) | 同步类型枚举、默认值、排除字段、错误消息映射 |
| [entrypoints/common/alarms/autoSyncAlarm.ts](entrypoints/common/alarms/autoSyncAlarm.ts) | 自动同步定时器：创建/重置/时间窗口判断 |
| [entrypoints/background/index.ts](entrypoints/background/index.ts) | Service Worker 入口：启动 alarm、监听设置变更 |
| [entrypoints/common/utils/common.ts](entrypoints/common/utils/common.ts) | `fetchApi()` HTTP 请求封装（超时/中止/错误处理） |
| [entrypoints/common/utils/sanitize.ts](entrypoints/common/utils/sanitize.ts) | `sanitizeContent()` 三层字符过滤 |
| [entrypoints/common/utils/importExport.ts](entrypoints/common/utils/importExport.ts) | `extContentImporter.niceTab()` 数据反序列化 |
| [entrypoints/options/sync/components/gist/SidebarContentModule.tsx](entrypoints/options/sync/components/gist/SidebarContentModule.tsx) | 同步 UI：卡片列表、配置抽屉、一键推送 |
| [entrypoints/options/sync/components/gist/SyncConfigForm.tsx](entrypoints/options/sync/components/gist/SyncConfigForm.tsx) | Token/Gist 配置表单 |
| [entrypoints/options/sync/components/SidebarBaseCardItem.tsx](entrypoints/options/sync/components/SidebarBaseCardItem.tsx) | 操作按钮：Pull/Push Force/Merge、重置状态 |
| [entrypoints/options/settings/FormModuleSync.tsx](entrypoints/options/settings/FormModuleSync.tsx) | 全局自动同步设置 UI |
| [entrypoints/options/sync/constants.ts](entrypoints/options/sync/constants.ts) | 远端选项配置、Token 页面 URL |
| [entrypoints/common/contextMenus.ts](entrypoints/common/contextMenus.ts) | 右键菜单 `START_SYNC` 入口 |
