# NiceTab Harness Guide

作用：告诉 AI 和工程代理如何在这个仓库里可靠地工作。

## Role

You are an engineering agent working in the NiceTab browser extension repository.

Your goal is to ship maintainable, testable changes without breaking browser-extension behavior across `background`, `options`, `popup`, `content`, and storage-backed workflows.

## Before You Start

Always read these materials in order before making a non-trivial change:

1. `README-zh.md` or `README.md`
2. `ARCHITECTURE.md`
3. `docs/index.md`
4. The most relevant file under `docs/`
5. The existing code in the affected entrypoint

Do not start patching until you know:

- which extension surface is changing
- which storage module owns the data
- whether Firefox behavior differs from Chromium behavior

## Project-Specific Working Rules

### Entry Points First

This repo is a multi-entry browser extension, not a single-page web app.

Start from the owning surface:

- `entrypoints/background/` for orchestration, alarms, commands, context menus, runtime messages
- `entrypoints/options/` for the main dashboard UI
- `entrypoints/popup/` for toolbar popup behavior
- `entrypoints/content/` for in-page UI or page-level effects
- `entrypoints/common/` for shared storage, utilities, locale, hooks, and browser adapters

### Respect Storage Ownership

Persistent data is centralized in `entrypoints/common/storage/`.

Do not scatter raw storage keys throughout the UI.

If a change touches tab list structure, settings, sync config, recycle bin, or runtime state:

- update the owning storage utility
- verify callers still match its contract
- document the behavior change in `docs/reference/`

### Browser Actions Flow Through the Right Layer

Any behavior that depends on browser APIs, tabs, windows, commands, alarms, badge state, or runtime messaging should be coordinated through `background` or shared browser utilities.

Do not bury browser orchestration inside a random React component when a shared utility or runtime message is the correct boundary.

### Cross-Browser Discipline

The manifest is built from `wxt.config.ts` and has explicit Chrome/Firefox differences.

When changing permissions, tab group behavior, commands, or action/popup behavior:

- verify the `isFirefox` branch
- check optional permissions vs required permissions
- keep Firefox fallback behavior explicit

### Documentation Must Track Product Behavior

If you change any of the following, update docs in the same task:

- tab capture or restore behavior
- tag/group/tab data rules
- import/export formats
- sync semantics for Gist or WebDAV
- popup module behavior
- build, packaging, or manual reload steps

### Generated Docs Path

`GUIDE-zh.md` is source content. `scripts/md2html.js` converts guide markdown into `public/docs/*.html` and refreshes `public/docs/css/github-markdown.css`.

If user-facing guide content changes, run the guide conversion flow and avoid leaving source markdown and generated docs out of sync.

## Plans

Create an ExecPlan following `PLANS.md` before implementation when work includes:

- storage-schema or storage-contract changes
- sync behavior changes
- cross-entrypoint features
- large UI restructuring
- browser permission or manifest changes

Store plans under `plans/`.

## Validation

For functional changes, run the smallest relevant validation set that still proves the change:

- `pnpm compile`
- `pnpm lint:no-fix`
- `pnpm build` or `pnpm build:firefox` when build behavior is affected
- manual extension reload checks in the browser when UI or browser APIs are affected

If you cannot run one of these, say so explicitly in the handoff.

## Deliverables

Every completed task should leave behind:

- working code
- updated docs when behavior changed
- updated ExecPlan when one was required
- a clear note about what was verified and what was not
