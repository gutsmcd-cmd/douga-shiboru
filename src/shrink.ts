// Video shrinking engines. WebCodecs (via mediabunny) first; ffmpeg.wasm single-thread fallback.
import { Input, ALL_FORMATS, BlobSource, Output, Mp4OutputFormat, BufferTarget, Conversion, canEncodeVideo, canEncodeAudio, type AudioCodec } from 'mediabunny'

export interface Info { duration: number; width: number; height: number; hasAudio: boolean }
export interface Plan { start: number; end: number; targetBytes: number; maxSide: number | 0; audioKbps: number }
export interface Result { blob: Blob; engine: 'webcodecs' | 'ffmpeg'; width: number; height: number; videoKbps: number }
type Prog = (p: number) => void

export async function probe(file: Blob): Promise<Info> {
  try {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
    const vt = await input.getPrimaryVideoTrack()
    const at = await input.getPrimaryAudioTrack()
    const duration = await input.computeDuration()
    if (!vt) throw new Error('no video')
    return { duration, width: vt.displayWidth, height: vt.displayHeight, hasAudio: !!at }
  } catch {
    // Fallback: let the browser's <video> read it.
    return await new Promise<Info>((res, rej) => {
      const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true
      v.onloadedmetadata = () => { res({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, hasAudio: true }); URL.revokeObjectURL(v.src) }
      v.onerror = () => rej(new Error('unreadable'))
      v.src = URL.createObjectURL(file)
    })
  }
}

/** Bitrate (bps) for the video track so the whole file lands just under the target. */
export function videoBitrate(plan: Plan, hasAudio: boolean): number {
  const dur = Math.max(0.5, plan.end - plan.start)
  const usable = plan.targetBytes * 8 * 0.93 - 40_000 * 8 // container overhead margin
  const v = usable / dur - (hasAudio ? plan.audioKbps * 1000 : 0)
  return Math.max(80_000, Math.min(v, 12_000_000))
}

/** Pick output size: user's choice, or automatic from bitrate. Never upscale. Even numbers. */
export function outSize(info: Info, plan: Plan, vbps: number): { w: number; h: number } {
  let side = plan.maxSide
  if (!side) side = vbps < 450_000 ? 640 : vbps < 1_100_000 ? 854 : vbps < 2_500_000 ? 1280 : 1920
  const long = Math.max(info.width, info.height)
  const k = Math.min(1, side / long)
  const ev = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2)
  return { w: ev(info.width), h: ev(info.height) }
}

export async function hasWebCodecs(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return false
  try { return await canEncodeVideo('avc', { width: 1280, height: 720, bitrate: 1e6 }) } catch { return false }
}

async function pickAudio(kbps: number): Promise<AudioCodec | null> {
  for (const c of ['aac', 'opus'] as AudioCodec[]) {
    try { if (await canEncodeAudio(c, { numberOfChannels: 2, sampleRate: 48000, bitrate: kbps * 1000 })) return c } catch { /* next */ }
  }
  return null
}

let cancelFn: (() => void) | null = null
export const cancel = () => cancelFn?.()

async function viaWebCodecs(file: Blob, info: Info, plan: Plan, vbps: number, prog: Prog): Promise<Result> {
  const { w, h } = outSize(info, plan, vbps)
  const ac = info.hasAudio ? await pickAudio(plan.audioKbps) : null
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const conv = await Conversion.init({
    input, output, tracks: 'primary',
    video: { width: w, height: h, fit: 'contain', codec: 'avc', bitrate: Math.round(vbps), forceTranscode: true, keyFrameInterval: 4 },
    audio: ac ? { codec: ac, bitrate: plan.audioKbps * 1000, numberOfChannels: 2, forceTranscode: true } : { discard: true },
    trim: { start: plan.start, end: plan.end },
  })
  if (!conv.isValid) throw new Error('invalid: ' + JSON.stringify(conv.discardedTracks.map((d) => d.reason)))
  conv.onProgress = (p) => prog(p)
  cancelFn = () => void conv.cancel()
  await conv.execute()
  cancelFn = null
  const buf = (output.target as BufferTarget).buffer!
  return { blob: new Blob([buf], { type: 'video/mp4' }), engine: 'webcodecs', width: w, height: h, videoKbps: Math.round(vbps / 1000) }
}

// ---- ffmpeg.wasm fallback (single-thread core, no cross-origin isolation needed). Core is fetched once and cached by the service worker.
const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'
let ff: import('@ffmpeg/ffmpeg').FFmpeg | null = null
async function viaFfmpeg(file: Blob, info: Info, plan: Plan, vbps: number, prog: Prog): Promise<Result> {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg')
  const { fetchFile } = await import('@ffmpeg/util')
  if (!ff) {
    ff = new FFmpeg()
    await ff.load({ coreURL: `${CORE}/ffmpeg-core.js`, wasmURL: `${CORE}/ffmpeg-core.wasm` })
  }
  const f = ff
  const { w, h } = outSize(info, plan, vbps)
  const dur = plan.end - plan.start
  const onP = ({ time }: { time: number }) => prog(Math.min(0.99, time / 1e6 / dur))
  f.on('progress', onP)
  cancelFn = () => { f.terminate(); ff = null }
  try {
    await f.writeFile('in', await fetchFile(file))
    const kb = Math.round(vbps / 1000)
    const args = ['-ss', String(plan.start), '-i', 'in', '-t', String(dur), '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', `scale=${w}:${h}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', `${kb}k`, '-maxrate', `${kb}k`, '-bufsize', `${kb * 2}k`, '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', `${plan.audioKbps}k`, '-ac', '2', '-movflags', '+faststart', 'out.mp4']
    const code = await f.exec(args)
    if (code !== 0) throw new Error('ffmpeg ' + code)
    const data = (await f.readFile('out.mp4')) as Uint8Array
    await f.deleteFile('in').catch(() => {}); await f.deleteFile('out.mp4').catch(() => {})
    return { blob: new Blob([data.slice().buffer], { type: 'video/mp4' }), engine: 'ffmpeg', width: w, height: h, videoKbps: kb }
  } finally { f.off('progress', onP); cancelFn = null }
}

/** Shrink to fit the target. If the first pass overshoots, redo once with a lower bitrate. */
export async function shrink(file: Blob, info: Info, plan: Plan, useWebCodecs: boolean, prog: (p: number, pass: number) => void, forceFfmpeg = false): Promise<Result> {
  let vbps = videoBitrate(plan, info.hasAudio)
  const run = async (b: number, pass: number) => {
    const p = (x: number) => prog(x, pass)
    if (useWebCodecs && !forceFfmpeg) {
      try { return await viaWebCodecs(file, info, plan, b, p) } catch (e) { if (String(e).includes('cancel')) throw e; console.warn('webcodecs failed, using ffmpeg', e) }
    }
    return await viaFfmpeg(file, info, plan, b, p)
  }
  let r = await run(vbps, 1)
  if (r.blob.size > plan.targetBytes) {
    vbps = Math.max(60_000, vbps * (plan.targetBytes / r.blob.size) * 0.9)
    r = await run(vbps, 2)
  }
  return r
}
