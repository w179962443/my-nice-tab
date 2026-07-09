# Runtime And Storage Reference

## Runtime Surfaces

### Background

Primary file: `entrypoints/background/index.ts`

Responsibilities:

- badge updates
- popup enable/disable behavior
- startup/install hooks
- tab listeners
- runtime message handling
- command and context-menu registration
- auto-sync alarm orchestration

### Options

Primary file: `entrypoints/options/App.tsx`

Main routes:

- `/home`
- `/settings`
- `/import-export`
- `/sync`
- `/recycle`

### Popup

Primary file: `entrypoints/popup/App.tsx`

Responsibilities:

- quick navigation to dashboard pages
- send-tab actions
- theme and compact-mode controls
- opened-tab preview and tab actions

### Content

Primary files:

- `entrypoints/content/index.tsx`
- `entrypoints/content/App.tsx`

Use this surface for page-level UI and effects only.

## Storage Modules

Primary storage bootstrap: `entrypoints/common/storage/index.ts`

Important modules:

- `TabListUtils`
  - storage key: `local:tabList`
  - owns the saved tag/group/tab hierarchy
- `SettingsUtils`
  - owns user preferences
- `ThemeUtils`
  - owns theme data
- `RecycleBinUtils`
  - owns deleted recoverable entities
- `StateUtils`
  - owns transient UI/runtime state such as popup and snapshot state
- `SyncUtils`
  - storage keys: `local:syncConfig`, `local:syncResult`, `local:syncStatus`
  - owns GitHub/Gitee Gist sync
- `SyncWebDAVUtils`
  - storage key: `local:syncWevDAVConfig`
  - owns WebDAV sync accounts and history

## Runtime Message Patterns

Common message intents include:

- theme and locale updates
- opening admin routes
- send-tab action requests
- sync status updates
- refreshing search or admin-page state

When a feature crosses popup, options, content, and background, prefer a shared runtime-message contract instead of duplicating browser calls in each surface.

## Product Data Shape

The persisted hierarchy is:

- tag
  - contains groups
- group
  - contains tabs
- tab
  - stores title, URL, favicon and related metadata

Important behaviors:

- exports remove runtime-only IDs
- imports regenerate IDs
- a static staging-area tag must remain valid
- merges may deduplicate by URL depending on workflow

## Import And Export Reference

Primary file: `entrypoints/common/utils/importExport.ts`

Supported formats:

- NiceTab
- OneTab
- Toby
- SessionBuddy
- KepTab
- Netscape bookmark HTML

If a format contract changes, update both parsing/export behavior and product docs.

## Sync Reference

Primary files:

- `entrypoints/common/storage/syncUtils.ts`
- `entrypoints/common/storage/syncWebDAVUtils.ts`

Supported remote targets:

- GitHub Gists
- Gitee Gists
- WebDAV

Supported sync modes conceptually include:

- manual pull merge
- manual pull force
- manual push merge
- manual push force
- auto push/pull variants

Important semantic rule:

- merge modes combine local and remote data
- force modes allow replacement behavior

Settings sync is optional and excludes some local-priority auto-sync settings from being overwritten wholesale.
