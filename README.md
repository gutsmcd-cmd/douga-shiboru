# 動画しぼる / Video Shrinker

Make phone videos (MP4/MOV) smaller on your device so they're easy to send by LINE or email. Pick a target (about 25 MB, half size, very small, or custom MB/resolution), optionally trim the start and end, and it re-encodes to H.264 MP4 right in the browser.

- Fast path: WebCodecs via [Mediabunny](https://mediabunny.dev) (no cross-origin isolation needed).
- Fallback: single-thread ffmpeg.wasm (core downloaded once from jsDelivr and cached). Slow.
- Bitrate is worked out from the duration to hit the target; if the first pass overshoots, it does one more pass.
- Japanese / English, large text switch, free, no ads, no login, works offline after the first visit.

`npm install && npm run build` → `dist/`. Deployed by `.github/workflows/pages.yml`.
