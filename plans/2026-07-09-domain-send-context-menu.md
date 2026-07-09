## Purpose

Replace the hard-coded `Send GitHub Tabs` and `Send Zhihu Tabs` actions with a dynamic context-menu workflow that lets users send tabs by currently opened domain. The new UX should expose a parent action named `发送所有指定域名标签页`, show runtime-generated domain children sorted by tab count, and keep the existing NiceTab send-and-close behavior.

## Context

- `entrypoints/common/contextMenus.ts`
  - owns context-menu definitions, grouping, and click dispatch
- `entrypoints/common/tabs.ts`
  - owns tab-query, send-to-NiceTab, and close-after-send behavior
- `entrypoints/common/constants.ts`
  - owns action ids and default menu configuration
- `entrypoints/types/global.ts`
  - owns send-action typing used by settings
- `entrypoints/options/settings/`
  - reads base menu definitions and auto-close action names
- `entrypoints/common/locale/`
  - owns visible labels for the new action
- `GUIDE-zh.md`
  - user-facing behavior documentation for context menus and send flows
- `docs/product/overview.md`
  - product reference for capture strategies

## Risks

- Existing saved `contextMenuConfig` values may still contain the retired GitHub/Zhihu action ids.
- Existing saved `actionAutoCloseFlags` values may still contain legacy domain-send action ids.
- `popup` reuses menu definitions, so runtime-only domain children must not accidentally flood popup action lists.
- Firefox-specific context-menu behavior must remain unchanged for the tab-level special menu.
- Guide markdown and generated extension docs can drift if regeneration is skipped.

## Plan

1. Introduce a new generic send-by-domain action id and locale text while keeping legacy domain ids readable for compatibility.
2. Refactor send-by-domain tab logic so runtime domain submenu clicks reuse one shared code path and respect existing send filters.
3. Replace the hard-coded GitHub/Zhihu menu entries with a dynamic submenu built from currently sendable tabs, sorted by count descending.
4. Keep popup and settings behavior stable by exposing only the root configurable action while excluding runtime domain children from popup action lists.
5. Normalize or tolerate legacy saved config values so existing users do not see blank menu rows or lose auto-close behavior unexpectedly.
6. Update product and user docs, then regenerate guide HTML.
7. Run the smallest useful validation set and record outcomes.

## Milestones

1. Runtime domain aggregation exists and can drive menu labels.
2. Context menu shows `发送所有指定域名标签页` with dynamic domain children.
3. Clicking a dynamic domain child sends the matching tabs to NiceTab and closes them according to settings.
4. Settings/docs remain coherent and generated guide output is refreshed.

## Progress

- [x] Repo docs and owning modules reviewed
- [x] ExecPlan created and kept current
- [x] Generic domain-send action wired
- [x] Dynamic domain submenu rendered
- [x] Legacy settings compatibility handled
- [x] Docs updated
- [x] Guide regenerated
- [x] Validation run

## Decision Log

- 2026-07-09: Treat runtime domain submenu entries as context-menu-only items so popup actions remain compact and predictable.
- 2026-07-09: Keep legacy GitHub/Zhihu action ids only as compatibility inputs and normalize them into the new generic domain-send action in settings state.

## Discoveries

- `entrypoints/common/contextMenus.ts` is also consumed by popup actions, so tag-based filtering is the cleanest way to avoid leaking dynamic domain children into popup.
- Existing settings UI builds menu names from `getBaseMenuMap()`, so retired action ids must be filtered or normalized to avoid blank configuration rows.
- `wxt build` can be blocked by a locked `.output/chrome-mv3/background.js` file when the unpacked Chrome extension is still in use, even when TypeScript and ESLint both pass.

## Validation

- `pnpm compile`
- `pnpm lint:no-fix`
- `pnpm convert:guide`
- `pnpm build` (passed after clearing stale `.output/chrome-mv3` artifacts and rerunning outside the sandbox because WXT/Vite hit `spawn EPERM` in the restricted environment)
- Manual check after reloading `.output/chrome-mv3`:
  - right-click extension icon
  - verify `发送所有指定域名标签页` exists
  - verify submenu children are sorted by count descending
  - click one domain and confirm tabs land in NiceTab and close as configured
- Firefox manual check if feasible:
  - verify special tab context menu still only exposes the expected Firefox entry

## Recovery

If interrupted, resume from `entrypoints/common/contextMenus.ts` and `entrypoints/common/tabs.ts` together; they form the main runtime contract for this feature. Before retrying validation, rerun menu generation from a fresh extension reload so stale browser menus do not mask logic changes.

## Retrospective

Implemented a generic send-by-domain context-menu parent that generates domain children from current sendable tabs, sorted by count descending, while keeping popup actions unchanged. Added legacy settings normalization so older GitHub/Zhihu menu ids and auto-close flags continue to behave correctly after the upgrade. Updated the product overview, README, and user guide, then regenerated the in-extension guide HTML.

Verified with `pnpm compile`, `pnpm lint:no-fix`, `pnpm convert:guide`, and `pnpm build`. Build verification required clearing stale `.output/chrome-mv3` files that were previously locked and rerunning `pnpm build` outside the sandbox because the restricted environment triggered `spawn EPERM`.
