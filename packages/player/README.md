# @libraryofages/player

The listening experience, built to feel like the Audible app. Library of Ages is the first
consumer; any app with chaptered audio can use it.

## Owns
Queue position, play/pause, seek, ±15 s (past the end → next track), the six speeds, the
chapter list with locked tracks, the sleep timer (15/30/45/60 min with a 5 s fade, or end of
chapter), local-file-first sources through the host's `resolveSource`, progress through a
`ProgressStore` (every 5 s while playing, on pause, on track change, on rate change, on
background, on unmount), a narrator switch that keeps the chapter and rewinds 15 s, and the
mini and full players.

## How it is built
Everything above sits on an `AudioEngine`: `HtmlAudioEngine` (one media element; web and
Jest) and `TrackPlayerEngine` (react-native-track-player 4.1.2: notification and lock-screen
controls, background playback, rate). Metro picks `createEngine.web.ts` on web and
`createEngine.ts` (native) elsewhere. The player logic is proven once on the HTML engine and
again in the playground journey (`apps/playground/e2e/player.spec.mjs`).

## Public surface
`<PlayerProvider theme progressStore resolveSource engineFactory voices onSwitchVoice
onTrackBlocked onPlaylistEnd saveIntervalMs />`, `usePlayer()` → state
(`playlist, index, positionSeconds, durationSeconds, playing, rate, sleepTimer, blockedIndex,
loaded, expanded, fading`) and `load(playlist, start?)`, `play`, `pause`, `toggle`, `seek`,
`jump(±s)`, `setRate`, `cycleRate`, `skipNext`, `skipPrev`, `goTo`, `setSleepTimer`,
`switchPlaylist`, `switchVoice`, `setExpanded`, `close`; `<MiniPlayer theme />`,
`<FullPlayerSheet theme />`, `<ChapterList theme />`; `registerPlaybackService()` for the host's
entry file. `Track.blocked` (kit-core 0.0.3) marks a listed track the player must refuse: it
calls `onTrackBlocked(index)` and never plays it. `onPlaylistEnd` fires once per playlist when
the last track ends; the host decides what that means.

## Must never contain
Fetching chapters, sample logic, upsell copy, colours. The host passes exactly the tracks the
user may play. A package may import React, React Native, Expo modules and
`@libraryofages/kit-core` only.

Device-only, not driven in CI: the track-player engine (background playback, the notification
and lock-screen controls, audio focus).
