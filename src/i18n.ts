export type Lang = 'ja' | 'en'
export const dict = {
  ja: {
    app: '動画しぼる', lead: 'スマホの動画を小さくして、LINEやメールで送りやすく。この端末の中で変換するので、動画は外に送りません。', toggle: 'English', big: '大きい文字',
    pick: '🎬 動画をえらぶ', pickSub: 'MP4・MOV（スマホで撮った動画）', change: '別の動画', info: (mb: string, d: string, w: number, h: number) => `${mb}・${d}・${w}×${h}`,
    target: 'どのくらい小さく？', presets: { line: 'LINE・メール向け（約25MB）', half: '半分のサイズ', small: 'とても小さく（約8MB）', custom: '自分で決める' },
    customMb: '目標サイズ（MB）', res: '画質（大きさ）', resAuto: 'おまかせ', trim: '前後をカットする', from: '開始（秒）', to: '終了（秒）',
    already: 'この動画はもう目標より小さいです。そのまま送れます。', est: (mb: string, w: number, h: number) => `できあがり予想：約${mb}・${w}×${h}`,
    go: '▶ 小さくする', stop: '■ やめる', working: (p: number, pass: number) => `変換中… ${p}%${pass > 1 ? '（2回目：サイズ調整）' : ''}`, left: (s: string) => `残り 約${s}`,
    done: 'できました！', before: '前', after: '後', saved: (p: number) => `${p}% 小さくなりました`, save: '💾 保存', share: '📤 共有', again: 'もう一度',
    fail: 'うまく変換できませんでした。別の設定か、別の動画でお試しください。', bad: 'この動画は読み込めませんでした。',
    slow: 'この端末では高速変換（WebCodecs）が使えないため、ゆっくりモードで変換します。数分〜数十分かかることがあります。初回は変換用データ（約31MB）をダウンロードします。',
    fast: '高速変換（WebCodecs）が使えます。', sec: '秒', min: '分',
    honest: '画面に表示されたまま待ってください（他のアプリに切り替えると止まることがあります）。長い動画や4K動画は時間がかかります。とても小さくすると画質が落ちます。',
    foot: '無料・広告なし・ログイン不要。動画はこの端末の中だけで処理します。一度開けばオフラインでも使えます。',
    credit: '変換: Mediabunny（MPL-2.0）／ffmpeg.wasm（LGPL）',
  },
  en: {
    app: 'Video Shrinker', lead: 'Make phone videos smaller so they are easy to send by LINE or email. It all happens on this device, so your video never leaves it.', toggle: '日本語', big: 'Large text',
    pick: '🎬 Choose a video', pickSub: 'MP4 or MOV (videos from your phone)', change: 'Another video', info: (mb: string, d: string, w: number, h: number) => `${mb} · ${d} · ${w}×${h}`,
    target: 'How small?', presets: { line: 'LINE / email friendly (about 25 MB)', half: 'Half the size', small: 'Very small (about 8 MB)', custom: 'Custom' },
    customMb: 'Target size (MB)', res: 'Picture size', resAuto: 'Automatic', trim: 'Trim the start and end', from: 'Start (s)', to: 'End (s)',
    already: 'This video is already smaller than the target. You can send it as it is.', est: (mb: string, w: number, h: number) => `Expected result: about ${mb}, ${w}×${h}`,
    go: '▶ Shrink it', stop: '■ Stop', working: (p: number, pass: number) => `Shrinking… ${p}%${pass > 1 ? ' (pass 2: fitting the size)' : ''}`, left: (s: string) => `About ${s} left`,
    done: 'Done!', before: 'Before', after: 'After', saved: (p: number) => `${p}% smaller`, save: '💾 Save', share: '📤 Share', again: 'Start over',
    fail: "Couldn't shrink this video. Try other settings or another video.", bad: "Couldn't read this video.",
    slow: "Fast mode (WebCodecs) isn't available on this device, so it uses slow mode. That can take several minutes or longer. The first time, it downloads the converter (about 31 MB).",
    fast: 'Fast mode (WebCodecs) is available.', sec: 's', min: 'min',
    honest: 'Keep this screen open while it works (switching apps can pause it). Long or 4K videos take a while. Very small targets lower the picture quality.',
    foot: 'Free, no ads, no login. Videos are processed only on this device. After the first visit it works offline.',
    credit: 'Conversion: Mediabunny (MPL-2.0) / ffmpeg.wasm (LGPL)',
  },
}
export type Dict = (typeof dict)['ja']
