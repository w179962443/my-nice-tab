# NiceTab Architecture

作用：告诉 AI 这个浏览器插件项目的整体结构、边界和不变量。

## Bird's Eye View

NiceTab is a multi-entry browser extension built with `WXT`, `React`, `Ant Design`, `styled-components`, and browser storage.

The system is organized around four runtime surfaces plus a shared domain layer:

1. `background`
2. `options`
3. `popup`
4. `content`
5. `common` shared logic

The primary product responsibility is managing browser tabs as a persisted hierarchy:

- tag
- tab group
- tab

This hierarchy is enriched by settings, snapshot state, recycle-bin state, import/export, and remote sync.

## Code Map

### Runtime Surfaces

- `entrypoints/background/`
  - background bootstrap
  - tab listeners
  - badge updates
  - startup/install behavior
  - runtime message handling
- `entrypoints/options/`
  - main dashboard SPA
  - routes: list, settings, import/export, sync, recycle bin
- `entrypoints/popup/`
  - toolbar popup
  - quick actions
  - opened-tab view
- `entrypoints/content/`
  - page-level injected behavior and message handling

### Shared Domain and Infrastructure

- `entrypoints/common/storage/`
  - settings
  - theme
  - tab list
  - recycle bin
  - sync config and sync status
  - UI/runtime state
- `entrypoints/common/tabs.ts`
  - browser tab orchestration
  - admin-page navigation
  - snapshot save/restore
  - page-title customization
- `entrypoints/common/contextMenus.ts`
  - send-tab actions and menu wiring
- `entrypoints/common/commands.ts`
  - keyboard-command wiring
- `entrypoints/common/utils/`
  - import/export parsers
  - runtime message helpers
  - URL, locale, sanitize, favicon, support helpers
- `entrypoints/common/locale/`
  - localized messages for extension UI
- `entrypoints/types/`
  - shared TypeScript contracts

### Assets and Build

- `assets/`
  - shared CSS and icons
- `public/`
  - icons
  - generated guide HTML and CSS
- `scripts/md2html.js`
  - converts markdown guide files to extension-hosted HTML docs
- `wxt.config.ts`
  - manifest, permissions, browser-specific config, Vite plugins

## Architectural Responsibilities

### Background

Owns browser-driven orchestration:

- toolbar badge state
- action popup enable/disable behavior
- startup/install listeners
- tab-event listeners
- alarms
- runtime message fan-in

It should coordinate browser behavior, not render UI.

### Options

Owns the primary management experience:

- hierarchical tab list
- settings forms
- import/export actions
- remote sync controls
- recycle-bin management

It may initiate actions, but shared or browser-dependent behavior should flow through storage utilities, shared tab utilities, or runtime messages.

### Popup

Owns fast interaction from the toolbar icon:

- quick navigation
- send-tab actions
- theme switching
- opened-tab preview and tab operations

Popup behavior is intentionally lighter than the dashboard and must stay consistent with settings-controlled module visibility.

### Content

Owns page-level injected behavior only.

Keep it thin and message-driven.

### Shared Storage and Domain

`entrypoints/common/storage/` is the core domain boundary for persisted extension state.

Key modules include:

- `TabListUtils` for the tag/group/tab tree
- `SettingsUtils` for user preferences
- `StateUtils` for transient UI/runtime state
- `RecycleBinUtils` for deleted entities
- `SyncUtils` and `SyncWebDAVUtils` for remote sync

## Data Model

The core persisted model is:

- tag: top-level category
- group: collection of tabs inside a tag
- tab: saved browser tab record

Important product conventions:

- the first static tag is the staging area
- restore/import/sync operations must preserve valid hierarchy
- empty unlocked groups may be auto-removed depending on settings
- exported data strips runtime-only identifiers and rebuilds them on import

## Integration Boundaries

### Browser Platform

Browser APIs are accessed through:

- `wxt/browser`
- background listeners
- shared tab utilities

Keep browser-specific behavior out of pure data transforms when possible.

### Remote Sync

Remote sync is implemented through adapters:

- Gitee/GitHub Gists in `SyncUtils`
- WebDAV in `SyncWebDAVUtils`

UI code should not embed remote protocol logic directly.

### User Guide Publishing

Guide markdown is authored in repo markdown files and converted to HTML for in-extension viewing.

Treat markdown source and generated `public/docs/` output as one workflow.

## Architecture Invariants

These rules should not be broken:

- UI components should not invent new storage contracts ad hoc.
- Cross-surface behavior must use shared utilities or runtime messages.
- Browser-permission assumptions must stay compatible with both Chromium and Firefox branches in `wxt.config.ts`.
- Import/export and sync behavior must preserve valid NiceTab data shape.
- User-visible documentation for changed behavior must be kept in sync.
