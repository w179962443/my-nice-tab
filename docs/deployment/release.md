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

## Personal Chromium Release

`public/release.json` contains a personal positive integer build number. It starts at `1` and is independent of the original project's `package.json` version. Raise `build` when users of an already installed personal build should see a download prompt. A new commit with the same `build` still gets packaged, but installed copies with that build show no prompt.

Every push to `master` runs `.github/workflows/build-extension.yml`: locked dependency installation, release tests, type check, lint, Chromium build, ZIP packaging, and metadata generation. The workflow uploads a GitHub Actions artifact named `nice-tab-personal-<commit SHA>`. Downloading that artifact from the run's **Artifacts** section yields `nice-tab-<build>-<commit SHA>.zip` and `latest.json`. The latter names the ZIP and records its SHA-256. The artifact is available to people with access to the repository's Actions runs; it is not a public update endpoint.

Set the GitHub Actions repository variable `NICETAB_UPDATE_MANIFEST_URL` to the final, publicly readable HTTPS URL of `latest.json`, for example `https://downloads.example.com/nice-tab/latest.json`. GitHub passes it as `WXT_UPDATE_MANIFEST_URL` at build time. The ZIP must be reachable at the same URL directory under the filename named by `latest.json`. Without this variable, builds still succeed and the extension does not request updates. Setting or changing the variable affects only builds made afterward: manually install a newly built ZIP once so the extension knows the URL. The manifest and ZIP should be served without login or redirects to a different origin.

To put files on a server once its details are confirmed:

1. Provide the server OS, IP or DNS name, absolute destination directory, upload method (such as SSH/SFTP), and the public HTTPS directory URL. Keep passwords and private keys out of the repository; any future workflow credential belongs in GitHub Actions Secrets.
2. Configure HTTPS static hosting so `latest.json` and its ZIP are publicly readable from the same directory.
3. Extend the workflow with the confirmed transport. Upload the ZIP fully first; replace `latest.json` last and atomically. A failed upload must leave the previous complete release referenced.
4. Test `latest.json`, the ZIP URL, and its SHA-256 from outside the server before relying on extension prompts.

The repository currently **does not upload to an IP or server** because the destination and transfer method have not been supplied. GitHub Actions artifact creation is the working handoff point.

For Chrome/Edge unpacked installations, extract the inner `nice-tab-<build>-<commit SHA>.zip` into a stable dedicated directory whose root contains `manifest.json` and `release.json`. Enable Developer mode on `chrome://extensions/` or `edge://extensions/`, then load that directory. For later builds, back up the directory, replace its extension files with the new ZIP contents while retaining the directory path, and click **Reload** on the browser's extension page. Opening the options page or popup checks the server when a URL is configured; the prompt only downloads the ZIP. The existing “立即升级” action is separate and has not been changed.

Local verification commands:

```text
pnpm test:release
pnpm compile
pnpm lint:no-fix
pnpm build
pnpm zip
node scripts/prepare-release.mjs public/release.json .output/chrome-mv3 .output .output/release-artifact <40-character-Git-SHA>
```
