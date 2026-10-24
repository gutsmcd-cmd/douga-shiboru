import './style.css'
import { registerSW } from 'virtual:pwa-register'
import { dict, type Lang, type Dict } from './i18n'
import { probe, shrink, cancel, hasWebCodecs, videoBitrate, outSize, type Info, type Plan, type Result } from './shrink'

registerSW({ immediate: true })
type Preset = 'line' | 'half' | 'small' | 'custom'
const PREF = 'douga-shiboru-prefs'
const S = {
  lang: 'ja' as Lang, big: false, preset: 'line' as Preset, customMb: 15, maxSide: 0,
  file: null as File | null, info: null as Info | null, inUrl: '', trim: false, start: 0, end: 0,
  busy: false, res: null as Result | null, outUrl: '', err: '', wc: true, wcKnown: false,
}
try { Object.assign(S, JSON.parse(localStorage.getItem(PREF) || '{}')) } catch { /* fresh */ }
const save = () => localStorage.setItem(PREF, JSON.stringify({ lang: S.lang, big: S.big, preset: S.preset, customMb: S.customMb, maxSide: S.maxSide }))
const T = (): Dict => dict[S.lang]
const app = document.getElementById('app')!
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string | null | false | undefined)[]) => {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v as EventListener)
    else if (k === 'testid') e.dataset.testid = String(v)
    else if (k in e) (e as unknown as Record<string, unknown>)[k] = v
    else e.setAttribute(k, String(v))
  }
  for (const c of kids) if (c) e.append(c)
  return e
}
const MB = 1024 * 1024
const fmtMb = (b: number) => (b >= 100 * MB ? Math.round(b / MB) : (b / MB).toFixed(1)) + ' MB'
const fmtT = (s: number) => { s = Math.round(s); return s >= 60 ? `${Math.floor(s / 60)}${T().min}${s % 60}${T().sec}` : `${s}${T().sec}` }

function targetBytes(): number {
  const size = S.file?.size ?? 0
  const frac = S.info && S.trim ? Math.max(0.05, (S.end - S.start) / S.info.duration) : 1
  if (S.preset === 'line') return 25 * MB
  if (S.preset === 'small') return 8 * MB
  if (S.preset === 'half') return Math.max(0.3 * MB, (size * frac) / 2)
  return Math.max(0.3, S.customMb) * MB
}
const plan = (): Plan => ({ start: S.trim ? S.start : 0, end: S.trim ? S.end : S.info!.duration, targetBytes: targetBytes(), maxSide: S.maxSide, audioKbps: 96 })

async function pick(f: File) {
  if (S.inUrl) URL.revokeObjectURL(S.inUrl)
  if (S.outUrl) URL.revokeObjectURL(S.outUrl)
  Object.assign(S, { file: f, info: null, res: null, outUrl: '', err: '', inUrl: URL.createObjectURL(f), trim: false })
  try { S.info = await probe(f); S.start = 0; S.end = Math.round(S.info.duration * 10) / 10 } catch { S.err = T().bad }
  render()
}

async function go() {
  if (!S.file || !S.info) return
  S.busy = true; S.err = ''; S.res = null; render()
  const st = document.querySelector('[data-testid=prog]') as HTMLElement, bar = document.querySelector('.bar i') as HTMLElement
  const t0 = performance.now(); let pass0 = 1, tp = t0
  try {
    S.res = await shrink(S.file, S.info, plan(), S.wc, (p, pass) => {
      if (pass !== pass0) { pass0 = pass; tp = performance.now() }
      const pc = Math.round(p * 100), el = (performance.now() - tp) / 1000
      st.textContent = T().working(pc, pass) + (p > 0.03 ? '　' + T().left(fmtT((el / p) * (1 - p))) : '')
      bar.style.width = pc + '%'
    })
    S.outUrl = URL.createObjectURL(S.res.blob)
    console.log('done in', ((performance.now() - t0) / 1000).toFixed(1), 's', S.res.engine, S.res.blob.size)
  } catch (e) { if (!String(e).toLowerCase().includes('cancel') && !String(e).includes('terminat')) { S.err = T().fail; console.error(e) } }
  S.busy = false; render()
}

const outName = () => (S.file?.name.replace(/\.[^.]+$/, '') || 'video') + '-small.mp4'
async function share() {
  if (!S.res) return
  const f = new File([S.res.blob], outName(), { type: 'video/mp4' })
  if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }) } catch { /* cancelled */ } } else dl()
}
function dl() { const a = h('a', { href: S.outUrl, download: outName() }); document.body.append(a); a.click(); a.remove() }

function render() {
  const t = T()
  document.documentElement.lang = S.lang; document.documentElement.classList.toggle('big', S.big); document.title = t.app
  const file = h('input', { type: 'file', accept: 'video/*,.mp4,.mov,.m4v', hidden: true, testid: 'file', onchange: (e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void pick(f) } }) as HTMLInputElement
  const I = S.info
  const kids: (Node | false | null | undefined)[] = [
    h('div', { className: 'top' }, h('h1', {}, t.app), h('div', { className: 'tg' },
      h('button', { className: 'tiny' + (S.big ? ' on' : ''), testid: 'big', 'aria-pressed': String(S.big), onclick: () => { S.big = !S.big; save(); render() } }, t.big),
      h('button', { className: 'tiny', testid: 'lang', onclick: () => { S.lang = S.lang === 'ja' ? 'en' : 'ja'; save(); render() } }, t.toggle))),
    h('p', { className: 'lead' }, t.lead),
    S.wcKnown && h('p', { className: S.wc ? 'small' : 'warn', testid: 'mode' }, S.wc ? t.fast : t.slow),
    file,
    !S.file ? h('button', { className: 'pick', testid: 'pick', onclick: () => file.click() }, h('span', { className: 'mt' }, t.pick), h('span', { className: 'ms' }, t.pickSub))
      : h('div', { className: 'card' },
        h('video', { src: S.inUrl, controls: true, playsInline: true, muted: true, preload: 'metadata', className: 'pv' }),
        I && h('p', { className: 'small', testid: 'info' }, t.info(fmtMb(S.file.size), fmtT(I.duration), I.width, I.height)),
        h('button', { className: 'ghost tiny', disabled: S.busy, onclick: () => file.click() }, t.change)),
    S.err ? h('div', { className: 'warn', testid: 'err' }, S.err) : null,
  ]
  if (I && !S.res) {
    const p = plan(), vb = videoBitrate(p, I.hasAudio), sz = outSize(I, p, vb)
    const fits = S.file!.size <= p.targetBytes && !S.trim && !S.maxSide
    kids.push(
      h('h2', {}, t.target),
      h('div', { className: 'presets' }, ...(['line', 'half', 'small', 'custom'] as Preset[]).map((k) =>
        h('button', { className: S.preset === k ? 'on' : '', testid: 'p-' + k, disabled: S.busy, onclick: () => { S.preset = k; save(); render() } }, t.presets[k]))),
      S.preset === 'custom' && h('label', { className: 'fld' }, t.customMb, h('input', { type: 'number', min: '0.5', step: '0.5', inputMode: 'decimal', value: String(S.customMb), testid: 'mb', onchange: (e: Event) => { S.customMb = Number((e.target as HTMLInputElement).value) || 15; save(); render() } })),
      h('label', { className: 'fld' }, t.res, h('select', { testid: 'res', disabled: S.busy, onchange: (e: Event) => { S.maxSide = Number((e.target as HTMLSelectElement).value); save(); render() } },
        ...[0, 1920, 1280, 854, 640, 426].map((v) => h('option', { value: String(v), selected: S.maxSide === v }, v ? `${v === 1920 ? 1080 : v === 1280 ? 720 : v === 854 ? 480 : v === 640 ? 360 : 240}p` : t.resAuto)))),
      h('label', { className: 'chk' }, h('input', { type: 'checkbox', checked: S.trim, testid: 'trim', disabled: S.busy, onchange: (e: Event) => { S.trim = (e.target as HTMLInputElement).checked; render() } }), ' ', t.trim),
      S.trim && h('div', { className: 'trim' },
        h('label', { className: 'fld' }, t.from, h('input', { type: 'number', min: '0', step: '0.1', value: String(S.start), testid: 'from', onchange: (e: Event) => { S.start = Math.max(0, Math.min(Number((e.target as HTMLInputElement).value) || 0, S.end - 0.5)); render() } })),
        h('label', { className: 'fld' }, t.to, h('input', { type: 'number', min: '0', step: '0.1', value: String(S.end), testid: 'to', onchange: (e: Event) => { S.end = Math.min(I.duration, Math.max(Number((e.target as HTMLInputElement).value) || I.duration, S.start + 0.5)); render() } }))),
      fits ? h('p', { className: 'status', testid: 'fits' }, t.already) : h('p', { className: 'small', testid: 'est' }, t.est(fmtMb(Math.min(p.targetBytes, S.file!.size)), sz.w, sz.h)),
      S.busy ? h('div', {}, h('div', { className: 'bar' }, h('i')), h('p', { className: 'status', testid: 'prog' }, t.working(0, 1)), h('button', { className: 'danger', testid: 'stop', onclick: () => cancel() }, t.stop))
        : h('button', { className: 'primary big-btn', testid: 'go', disabled: fits, onclick: () => void go() }, t.go))
  }
  if (S.res && S.file) {
    const pct = Math.max(0, Math.round((1 - S.res.blob.size / S.file.size) * 100))
    kids.push(h('div', { className: 'card done', testid: 'done' },
      h('h2', {}, '✅ ' + t.done),
      h('div', { className: 'ba' }, h('div', {}, h('div', { className: 'small' }, t.before), h('b', { testid: 'before' }, fmtMb(S.file.size))), h('div', { className: 'arrow' }, '→'),
        h('div', {}, h('div', { className: 'small' }, t.after), h('b', { testid: 'after' }, fmtMb(S.res.blob.size)))),
      h('p', { className: 'good' }, t.saved(pct) + `（${S.res.width}×${S.res.height}）`),
      h('video', { src: S.outUrl, controls: true, playsInline: true, preload: 'metadata', className: 'pv', testid: 'out' }),
      h('div', { className: 'acts' }, h('button', { className: 'primary', testid: 'share', onclick: () => void share() }, t.share), h('button', { testid: 'save', onclick: dl }, t.save)),
      h('button', { className: 'ghost', onclick: () => { S.res = null; render() } }, t.again)))
  }
  kids.push(h('p', { className: 'honest' }, t.honest), h('p', { className: 'foot' }, t.foot), h('p', { className: 'foot' }, t.credit))
  app.replaceChildren(...(kids.filter(Boolean) as Node[]))
}
render()
void hasWebCodecs().then((ok) => { S.wc = ok && !new URLSearchParams(location.search).has('slow'); S.wcKnown = true; if (!S.busy) render() })
;(window as unknown as Record<string, unknown>).__pick = pick
