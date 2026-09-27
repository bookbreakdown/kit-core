# @libraryofages/reader

The reading experience, built to feel like the Kindle app. Library of Ages is the first
consumer; any app with chaptered Markdown can use it.

## Owns
The WebView-hosted page engine (shared with the web reader via `kit-core/page-engine`),
immersive chrome that hides and shows, tap zones and swipe, instant page turns, a progress
footer with learned time-left, the typography sheet (theme, brightness, size, family, spacing,
margins, alignment), the go-to slider with a back pill, TOC, selection with Copy/Share/Define,
keep-awake, system font scale, position restore/save through a `PositionStore` (last and
furthest), a notice slot, and an `insertPages` hook for host-supplied pages.

## Public surface
`<Reader bookId document themes positionStore settingsStore furthest title labels onBack
onPositionChange onChapterChange onChapterEnd onBookEnd onSelection renderNotice renderLocked
insertPages hostComponent />` with a `ReaderHandle` ref (`goToChapter`, `goToPct`, `toggleChrome`,
`onVolumeKey`); `useReaderSettings(store)`, `usePosition`, `useReadingSpeed`, `buildReaderDocument`,
`renderChapterHtml`, `PageHost`. `onChapterEnd(i)` fires on every forward crossing (the host's
finish rule compares `i` with `finishChapterIndex`); `onBookEnd` once past the last page of the
last chapter. Settings keys in the host's store: `reader.settings`, `reader.wpm`,
`reader.furthest-dismissed.{bookId}`.

## How it is built
`document.ts` renders one chapter into a complete HTML document: theme and typography as CSS
variables, the kit-core page engine (`ENGINE_SOURCE`) and a JSON bridge. A `PageHost` loads it:
`PageHost.web.tsx` is a sandboxed `srcdoc` iframe with `postMessage`; `PageHost.tsx` is
`react-native-webview` with `injectJavaScript`. The bridge posts `ready`, `page`, `tap`, `edge`,
`key`, `selection`, `error` and accepts `next`, `prev`, `goTo`, `goToPct`, `relayout`,
`setSettings` (live, position kept), `setBody`. The host is remounted per chapter; settings are
pushed in place. Page margins live on the column's blocks so pages stay exactly one width apart.

Not yet driven anywhere but a device: the WebView host itself (pagination, the Copy/Share/Define
menu) and volume-key page turns. Everything else is covered by Jest and the playground journey
(`apps/playground/e2e/reader.spec.mjs`).

## Must never contain
Fetching text, deciding locks, app copy, app colours, any promotion. A package may import
React, React Native, Expo modules and `@libraryofages/kit-core` only.

