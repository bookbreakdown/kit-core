# mobile-kit

Shared React Native packages, published to npm under the `@libraryofages` scope: the book
reader, the audio player, the offline downloads engine, and the contract types they share.
Library of Ages is the first consumer (`/var/www/openshelf/mobile/`); Comeback's Learn tab is
the intended second. Four packages: `@libraryofages/kit-core`, `@libraryofages/reader`,
`@libraryofages/player`, `@libraryofages/downloads` (table below), plus `apps/playground`, the
demo app that drives them on fixtures. This repo
is the JavaScript sibling of `turnkeyagentic/core` (`/var/www/vendor/core`): same org, same
checkout location, same edit-tag-pin workflow (`docs/workflow.md`), separate repo because npm
and Composer do not mix.

## Packages

| Package | Owns | Public surface | Must never contain |
|---|---|---|---|
| `@libraryofages/kit-core` | Contract types (`Theme`, `BookDocument`, `Playlist`, `BundleManifest`, `PositionStore`, `ProgressStore`, `ValidityPolicy`), the page engine (`page-engine/engine.js`: column layout, paging, tap zones, swipe, keys, anchored relayout; the same file the web reader imports, also exported as `ENGINE_SOURCE` for the reader's page document), the markdown → chapters parser (byte-for-byte port of the web reader), time and size formatters. Pure TypeScript, Jest in Node. | Types and functions only. | Anything with a screen or a network call. |
| `@libraryofages/reader` | The Kindle-feel reading experience: the page document (engine + bridge) in a `PageHost` (sandboxed iframe on web, `react-native-webview` on Android), immersive chrome, tap zones, typography sheet applied live, learned time-left footer, go-to slider with back pill, TOC with back-matter divider, furthest-position prompt, position store, notice slot, `insertPages` hook, `onChapterEnd`/`onBookEnd`. Device-only, not driven in CI: the WebView host itself and its Copy/Share/Define menu, volume-key page turns (the handle's `onVolumeKey`). | `<Reader … />`, `useReaderSettings()`, `buildReaderDocument()`, `PageHost`. | Fetching text, deciding locks, app copy, app colours, any promotion. |
| `@libraryofages/player` | The Audible-feel listening experience: track-player service, mini and full player, queue, speed, sleep timer, local-file-first sources, lock-screen controls, progress store. | `<PlayerProvider … />`, `usePlayer()`, `<MiniPlayer />`, `<FullPlayerSheet />`, `registerPlaybackService()`. | Fetching chapters, sample logic, upsell copy. |
| `@libraryofages/downloads` | Manifest-driven queue, resumable chapter-ordered downloads, sha256 verification, bundle store, storage accounting, Wi-Fi-only, update detection, validity via a policy adapter, `DownloadsList`. | `<DownloadsProvider … />`, `useDownloads()`, `<DownloadsList />`, `resolveLocal()`. | Auth headers, entitlement calls, what "gated" means. |

**The rule:** a package may import React, React Native, Expo modules and `kit-core`. It may not
import from an app, call the network, know a URL shape, decide whether content is locked, or
contain a colour, a brand string or a slug. Hosts supply content, theme, adapters and callbacks.

Full requirements: `/var/www/openshelf/specs/android-app-urd.md` §8b.

## Toolchain (recorded at F0, 2026-09-24)

| Tool | Version |
|---|---|
| Node / npm | 22.22.1 / 10.9.4 |
| expo | 57.0.25 |
| react-native | 0.86.3 |
| react / react-dom | 19.2.3 |
| typescript | 6.0.3 (playground), ^5.3 (packages) |
| jest / ts-jest | 29.x (kit-core) |
| react-native-web | 0.21.2 |
| @react-navigation/native / native-stack | 7.4.1 / 7.19.2 |

Package peer ranges are `expo >= 54`, `react >= 19.1`, `react-native >= 0.81` so Comeback (SDK 54)
can consume them.

## Commands

```bash
npm install                 # workspaces: packages/* and apps/*
npm test                    # every package's jest (kit-core today)
npm run typecheck           # tsc --noEmit in every package
cd apps/playground
npx expo export --platform android --output-dir dist-android   # Android bundle
npx expo export --platform web --output-dir dist && npx serve dist -l 4173 -s
node e2e/boot.spec.mjs      # driven web boot journey (uses openshelf's Playwright)
```

**On a device:** this build machine (WSL) has no Android SDK. Run `npx expo start` from a machine
with Android tooling and open the playground in an emulator, or make an EAS development build
and install it on a phone. Web and the Android bundle are proven here; the on-device boot is the
owner's check.

## Fixtures

`packages/kit-core/fixtures/*.md` are byte-identical copies of served Library of Ages texts
(public domain): `treasure-island`, `1-enoch`, `1-esdras` (a 1 KB served stub whose first line is a
`##` heading), `baled-hay-…` (leftover code fences), `1-enoch-a-summary` (no headings). They are
never edited. `fixtures/expected/*.json` is written only by `scripts/generate-expected.mjs`, which
runs the **web reader's own** `parseChapters` (imported from the openshelf checkout) so the kit
parser is tested for equality with what libraryofages.com paginates.

## Licence

MIT. See [`LICENSE`](LICENSE). Every package's `package.json` carries `"license": "MIT"`. The
fixtures are public-domain texts.
