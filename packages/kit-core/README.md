# @libraryofages/kit-core

Shared types and pure logic for every kit package. No React Native imports; Jest-tested in Node.

## Owns
`Theme`, `BookDocument` (title, chapters[] of `{title, markdown}`), the page engine (column CSS +
paging script, consumed by the web `ReaderPage` and the kit reader's WebView; arrives in F4),
`Playlist`, `BundleManifest`, the `PositionStore` / `ProgressStore` / `ValidityPolicy`
interfaces, the markdown → chapters parser (a byte-for-byte port of the web reader's pre-clean
and `parseChapters`), and time and size formatters.

## Public surface
Types and functions only: `parseBook`, `preClean`, `splitChapters`, `EmptyBookError`,
`formatClock`, `formatBytes`, `wordCount`, and every contract type. See `docs/contracts.md`.

## Must never contain
Anything with a screen or a network call.

## Fixtures
`fixtures/*.md` are byte-identical copies of served Library of Ages texts (public domain) and
are never edited. `fixtures/expected/*.json` is written only by `scripts/generate-expected.mjs`,
which runs the web reader's own parser against them.
