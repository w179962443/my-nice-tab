# NiceTab Execution Plans

作用：告诉 AI 在这个仓库里如何写长期执行计划。

## When to Use

Create an ExecPlan for this repo when work involves any of the following:

- new product behavior spanning multiple entrypoints
- storage shape or storage-key changes
- sync logic changes for Gist or WebDAV
- manifest or permission changes
- route-level dashboard restructuring
- import/export format changes
- browser compatibility work across Chrome and Firefox

Small copy edits or isolated bug fixes usually do not need an ExecPlan.

## Principles

An ExecPlan must be:

- self-contained
- specific to this repository
- updated while work is happening
- testable by another engineer
- explicit about browser-surface impact

The plan should let a newcomer answer:

- which surface owns the feature
- which shared modules are affected
- which browser behaviors may regress
- how to validate Chrome and Firefox expectations

## Required Sections

Every ExecPlan in this repo should contain:

### Purpose

What user or product outcome are we changing?

### Context

List the affected files and surfaces, for example:

- `entrypoints/background/`
- `entrypoints/options/`
- `entrypoints/popup/`
- `entrypoints/common/storage/`
- `wxt.config.ts`
- docs that must be updated

### Risks

Call out known risk areas such as:

- storage migrations
- cross-window sync
- browser permission differences
- generated docs drift

### Plan

Describe the implementation steps in execution order.

Avoid vague wording like "handle edge cases later".

### Milestones

Split work into checkpoints that produce observable behavior.

### Progress

Use a live checklist, for example:

- [x] storage contract updated
- [x] options page wired
- [ ] popup behavior verified
- [ ] docs regenerated

### Decision Log

Record important decisions with date and reason.

### Discoveries

Log any non-obvious findings during implementation.

### Validation

Include exact commands and manual checks. Prefer concrete repo commands such as:

- `pnpm compile`
- `pnpm lint:no-fix`
- `pnpm build`
- reload `.output/chrome-mv3` in Chrome and verify the affected flow

If Firefox behavior is touched, include the Firefox-specific validation path too.

### Recovery

Explain how to retry safely if the task is interrupted.

If storage behavior changes, explain how to avoid leaving partial state behind.

### Retrospective

After completion, summarize what changed, what was verified, and what follow-up remains.
