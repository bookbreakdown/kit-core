# Contracts

Defined in `@libraryofages/kit-core` (`src/types.ts`). Any backend that feeds a kit package emits
these shapes; the Library of Ages API adopts them (URD SR-DL-01, SR-LIB-02). Fields are
camelCase in TypeScript; a JSON API may serve snake_case and the host adapter maps.

## BookDocument
| Field | Meaning |
|---|---|
| `title` | Display title; also the single-chapter fallback title. |
| `chapters[]` | `{ index, title, markdown, wordCount }` in reading order; `index` is 0-based and contiguous. |
| `finishChapterIndex` | Index of the last main-text chapter (back matter follows), or null when the host has not said. Drives "finished". |

## Playlist
`Track.blocked?: boolean` (kit-core 0.0.3): the host lists a track it will not allow (a locked chapter); the player shows it with a lock, refuses to play it and calls `onTrackBlocked(index)`.

| Field | Meaning |
|---|---|
| `id`, `title` | Stable id (the host's book id) and display title. |
| `tracks[]` | `{ id, index, title, source, durationSeconds, artworkUrl?, backMatter }`; `source` is `{kind:'url',url}` or `{kind:'file',path}`. The host passes exactly the tracks the user may play. |
| `finishTrackIndex` | Index of the last main-text track, or null. |

## BundleManifest
| Field | Meaning |
|---|---|
| `id`, `title` | Book id and title. |
| `content` | `{ url, byteSize, sha256, wordCount }` for the Markdown text. `sha256` is `string \| null`: null when the server could not hash the object; `byteSize` still verifies. |
| `cover` | `{ url, byteSize, sha256 \| null }` or null. |
| `voices[]` | `{ voice, label, chapters[] }`; each chapter `{ chapterNumber, title, url, byteSize, sha256 \| null, durationSeconds, backMatter }`. Only voices and chapters the caller may download are present. |
| `gated` | True when any part of this bundle is supporter-only. |
| `offlineValidUntil` | ISO instant after which gated content needs an online check, or null when it never expires. |
| `finishChapterIndex` | As in BookDocument. |

## Stores and policies (host adapters)
| Interface | Contract |
|---|---|
| `PositionStore` | `load(bookId) → ReadingPosition \| null`, `save(bookId, position)`. `ReadingPosition = { chapterIndex, offsetPct (0–100), pageIndex \| null }`; `offsetPct` is canonical across devices. |
| `ProgressStore` | `load(playlistId) → ListeningPosition \| null`, `save(playlistId, position)`. `ListeningPosition = { trackIndex, positionSeconds, rate }`. |
| `ValidityPolicy` | `isPlayable(manifest, now) → { ok: true } \| { ok: false, reason: 'expired' \| 'lapsed' \| 'locked' }`. The host decides; the package renders. |

## Theme
`{ name, colors: { background, text, muted, accent, surface, border }, fonts: { serif, sans } }`.
Packages contain no colour values; every colour comes from the host's theme.

## Page engine bridge (reader document ↔ host)
The reader's page document (`@libraryofages/reader` `buildReaderDocument`) embeds kit-core's
`page-engine/engine.js` and talks to its host as JSON strings over `window.ReactNativeWebView.postMessage`
(WebView) or `parent.postMessage` (iframe). Commands arrive as `message` events (iframe) or
through `window.__apply(cmd)` (WebView `injectJavaScript`).

| Message (page → host) | Fields | When |
|---|---|---|
| `ready` | — | After the first layout. |
| `page` | `page`, `count`, `offsetPct` | After every page or count change. |
| `tap` | `zone: left \| center \| right` | A tap without drag, by thirds of the width (left/right already turned the page). |
| `edge` | `direction: next \| prev` | A turn (tap, swipe, key or API) had no page to move to. |
| `key` | `key: ArrowLeft \| ArrowRight` | Keyboard inside the page; the host decides. |
| `selection` | `action: copy \| share \| define`, `text` | WebView custom menu (device only). |
| `error` | `message` | Engine failed to start. |

| Command (host → page) | Fields | Effect |
|---|---|---|
| `next`, `prev` | — | Turn a page; `edge` if none. |
| `goTo` | `page` | Clamped page index. |
| `goToPct` | `pct` | Page nearest that percent of the chapter. |
| `relayout` | — | Re-measure, keeping the visible text. |
| `setSettings` | `vars` (CSS variable string from `themeVariables`) | Applies theme and typography in place, keeping the visible text. |
| `setBody` | `bodyHtml` | Swaps the chapter and lays out from page 0. |

Position keeping: on every navigation the engine records the first visible text position; a relayout
(font, theme, resize) puts the page containing that text on screen. CSS columns cannot begin a page at an
arbitrary character, so the top line may sit up to a page earlier than before; consecutive relayouts keep
the same anchor so a stepper does not drift.

## Downloads storage and records (`@libraryofages/downloads`)
| Thing | Shape |
|---|---|
| Record keys | `text:{id}`, `audio:{id}:{voice}` |
| File keys | `{recordKey}:content`, `{recordKey}:cover`, `{recordKey}:ch{chapterNumber}` |
| `DownloadRecord` (persisted as `item:{key}`) | `{ key, id, title, kind: 'text'\|'audio', voice, files: [{ key, url, bytes, sha256, done, label }], state, error, lockedReason, gated, validUntil, manifestHash, manifest, createdAt, held }` |
| States | `queued`, `downloading`, `paused`, `ready`, `update-available`, `locked` (+ `lockedReason: expired \| lapsed \| locked`), `failed` (+ `error`) |
| Settings (`settings`) | `{ wifiOnly: true, autoDownloadNext: false }` |
| `BundleStorage` | `writeStream(key, body, expectedBytes, onProgress?, signal?) → { bytes, sha256 \| null }`, `exists`, `size`, `delete`, `deletePrefix`, `localSource(key) → TrackSource`, `readText`, `totalBytes`, `freeBytes`, `getJson/putJson/deleteJson/listJson` |
| `Connectivity` | `current() → { online, type: wifi \| cellular \| ethernet \| other \| none \| unknown }`, `subscribe(handler) → unsubscribe`. Wi-Fi-only blocks only `cellular`. |

Integrity: byte size is always checked against the manifest; sha256 when the manifest carries one
and the platform hashed the file (web ≤ 64 MB, Android ≤ 16 MB). A mismatch deletes the file and
marks the item `failed` with the reason.
