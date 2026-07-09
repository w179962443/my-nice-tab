# ADR Index

## Purpose

Use this directory to record architecture decisions that should outlive a single task or pull request.

## When To Add An ADR

Create an ADR when the team makes a durable choice about:

- framework or build tooling
- browser support strategy
- storage shape or migration strategy
- sync semantics
- document-generation workflow
- major UI surface boundaries

## Current Baseline Decisions

The repository currently reflects these high-level decisions:

1. `WXT` is the extension framework and manifest/build entrypoint.
2. `React + Ant Design + styled-components` power the primary UI surfaces.
3. Saved tab data is modeled as `tag -> group -> tab`.
4. Browser orchestration is centralized in shared browser utilities and background listeners.
5. Remote sync supports both Gist-based and WebDAV-based adapters.
6. User guides are authored in markdown and published into extension-hosted HTML under `public/docs/`.

## Suggested Naming

When adding a new ADR, use a file name like:

- `0001-browser-support-strategy.md`
- `0002-storage-shape-for-sync.md`

Include:

- status
- context
- decision
- consequences
