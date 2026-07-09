# Engineering Workflow

## Local Commands

Primary commands from `package.json`:

- `pnpm install`
- `pnpm dev`
- `pnpm dev:firefox`
- `pnpm build`
- `pnpm build:firefox`
- `pnpm zip`
- `pnpm zip:firefox`
- `pnpm compile`
- `pnpm lint:no-fix`
- `pnpm lint`

`pnpm dev` and `pnpm build` both run `convert:guide` first.

## Code Ownership By Area

Use the owning module instead of patching around it:

- browser lifecycle and listeners: `entrypoints/background/`
- main admin UI: `entrypoints/options/`
- toolbar interaction: `entrypoints/popup/`
- page injection: `entrypoints/content/`
- shared persistence and contracts: `entrypoints/common/storage/`, `entrypoints/types/`
- import/export parsing: `entrypoints/common/utils/importExport.ts`
- browser tab orchestration: `entrypoints/common/tabs.ts`
- manifest and browser-specific setup: `wxt.config.ts`

## Documentation Workflow

There are two documentation layers:

1. source markdown such as `GUIDE-zh.md`
2. generated extension-hosted docs in `public/docs/`

If guide content changes, keep the generated HTML/CSS output in sync through the conversion workflow.

Because `scripts/md2html.js` recopies `public/docs/css/github-markdown.css`, treat that file as generated unless the project intentionally decides to maintain a local divergence.

## Change Checklist

When touching behavior, check the nearby system, not just the component:

- storage contract changes
- locale strings
- runtime messages
- popup/options/background consistency
- Chrome vs Firefox manifest branches
- user guide or docs updates

## Verification Expectations

Choose the smallest useful set, but be explicit:

- use `pnpm compile` for TypeScript confidence
- use `pnpm lint:no-fix` when editing JS/TS logic
- use `pnpm build` when manifest, entrypoints, or generated assets are involved
- manually reload the extension when UI or browser integrations change

For Chrome manual reload, the local tutorial currently points to `.output/chrome-mv3`.

## Review Heuristics

Be extra careful around:

- tab send/restore flows
- storage migrations
- sync merge vs force semantics
- popup-empty-modules behavior
- Firefox permission and privileged-URL differences
