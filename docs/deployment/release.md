# Build And Release Notes

## Build Targets

This repo builds browser-extension bundles through WXT.

Common commands:

- `pnpm build` for the default Chromium target
- `pnpm build:firefox` for Firefox
- `pnpm zip`
- `pnpm zip:firefox`

## Generated Output

Build artifacts are emitted under `.output/`.

The local usage guide for Chrome development currently expects the unpacked extension directory at:

- `.output/chrome-mv3`

If the browser target changes, use the corresponding WXT output directory for that build.

## Manual Reload Loop

Typical Chrome verification flow:

1. run `pnpm build` or `pnpm dev`
2. open `chrome://extensions/`
3. reload the NiceTab extension
4. verify the affected popup, options, background, or content behavior

## Guide Publishing

Guide content is part of the shipped extension experience.

When guide markdown changes:

1. update source markdown
2. run the conversion flow
3. verify generated files under `public/docs/`
4. confirm in-extension guide links still open correctly

## Release Risks To Watch

Pay special attention to:

- manifest permission changes
- Firefox compatibility branches
- sync regressions
- generated docs drift
- popup behavior when no modules are configured
