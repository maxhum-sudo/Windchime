/**
 * Shared windchime poem engine.
 * Boot with: import { boot } from './engine.js'; boot(locale)
 */
import './style.css'
import {
  PRESETS,
  initChimes,
  playMelodicChime,
  setPreset,
  setMode,
  activePresetKey,
} from './chimes.js'

const INFLUENCE_RADIUS = 100
const SPRING = 0.08
const DAMPING = 0.86
const ANGLE_SPRING = 0.045
const ANGLE_DAMPING = 0.935
const MAX_ANGLE = 0.25
const CHIME_COOLDOWN_MS = 85
const RELEASE_MIN_ANGLE = 0.04
const GUST_SPEED = 0.03
const PUSH_BASE = 10
const PUSH_TIP = 22
const PUSH_Y_BASE = 5
const PUSH_Y_TIP = 14
const TWIST_DEG = 12
const MOTION_DEADZONE = 0.35
const SPEED_DECAY = 0.82
const MOTION_REF = 12

/** @type {any[]} */
let columns = []
let pointer = { x: -9999, y: -9999, active: false, speed: 0, vx: 0, vy: 0 }
let audioCtx = null
let lastChimeAt = 0
let audioUnlocked = false
/** @type {any} */
let locale = null
let showEnglish = false

const field = () => document.getElementById('poem-field')
const meta = () => document.getElementById('poem-meta')
const hint = () => document.getElementById('audio-hint')
const presetSelect = () => document.getElementById('chime-preset')
const translateToggle = () => document.getElementById('translate-toggle')

function activePoem() {
  if (showEnglish && locale?.poem?.en) return locale.poem.en
  return locale.poem
}

function graphemes(text) {
  if (showEnglish) {
    return text.split(/\s+/).filter(Boolean)
  }
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter(locale?.lang || 'en', { granularity: 'grapheme' })
    return [...seg.segment(text)].map((s) => s.segment)
  }
  return [...text]
}

function renderMeta() {
  const el = meta()
  if (!el) return
  const p = activePoem()
  el.innerHTML = `
    <span class="title">${p.title}</span>
    <span class="author">${p.era} · ${p.author}</span>
  `
}

function renderPoem() {
  const el = field()
  if (!el) return
  el.innerHTML = ''
  const dir = showEnglish ? 'ltr' : locale.columnDir
  el.dataset.dir = dir
  el.classList.toggle('cols-ltr', dir === 'ltr')
  el.classList.toggle('cols-rtl', dir === 'rtl')
  el.classList.toggle('is-english', showEnglish)
  document.body.classList.toggle('is-english', showEnglish)

  const frag = document.createDocumentFragment()
  for (const line of activePoem().lines) {
    const lineEl = document.createElement('span')
    lineEl.className = 'poem-line'
    for (const ch of graphemes(line)) {
      if (ch === ' ' || ch === '\u00a0') continue
      const span = document.createElement('span')
      span.className = showEnglish ? 'char word' : 'char'
      span.textContent = ch
      lineEl.appendChild(span)
    }
    frag.appendChild(lineEl)
  }
  el.appendChild(frag)
  columns = []
  requestAnimationFrame(() => measureHomes())
}

function setupTranslateToggle() {
  const input = translateToggle()
  if (!input || !locale?.poem?.en) return
  input.checked = showEnglish
  input.addEventListener('change', () => {
    showEnglish = input.checked
    renderMeta()
    renderPoem()
  })
}

function measureHomes() {
  for (const col of columns) {
    for (const p of col.chars) p.el.style.transform = ''
  }

  const lines = [...(field()?.querySelectorAll('.poem-line') || [])]
  const next = []

  lines.forEach((lineEl, colIndex) => {
    const prev = columns[colIndex]
    const charEls = [...lineEl.querySelectorAll('.char')]
    const chars = charEls.map((el, index) => {
      const htmlEl = /** @type {HTMLElement} */ (el)
      const rect = htmlEl.getBoundingClientRect()
      const homeX = rect.left + rect.width / 2
      const homeY = rect.top + rect.height / 2
      const prevChar = prev?.chars[index]
      return {
        el: htmlEl,
        homeX,
        homeY,
        x: prevChar ? homeX + (prevChar.x - prevChar.homeX) : homeX,
        y: prevChar ? homeY + (prevChar.y - prevChar.homeY) : homeY,
        vx: prevChar?.vx ?? 0,
        vy: prevChar?.vy ?? 0,
        index,
        phase: prevChar?.phase ?? (colIndex * 0.7 + index * 0.4) % (Math.PI * 2),
      }
    })

    next.push({
      el: /** @type {HTMLElement} */ (lineEl),
      chars,
      angle: prev?.angle ?? 0,
      angularVel: prev?.angularVel ?? 0,
      phase: prev?.phase ?? (colIndex * 0.61) % (Math.PI * 2),
      held: prev?.held ?? false,
    })
  })

  columns = next
}

async function initAudio() {
  if (audioCtx) return
  audioCtx = new AudioContext()
  await initChimes(audioCtx)
}

async function unlockAudio() {
  if (audioUnlocked) return
  try {
    await initAudio()
    if (audioCtx.state === 'suspended') await audioCtx.resume()
    audioUnlocked = true
    hint()?.classList.add('is-hidden')
  } catch (err) {
    console.warn('Audio unlock failed', err)
  }
}

function playChime(intensity = 0.5, noteHint) {
  if (!audioUnlocked || !audioCtx) return
  const now = performance.now()
  if (now - lastChimeAt < CHIME_COOLDOWN_MS) return
  lastChimeAt = now
  playMelodicChime(intensity, noteHint)
}

function setupChimePicker() {
  const select = presetSelect()
  if (!select) return
  for (const [key, preset] of Object.entries(PRESETS)) {
    const opt = document.createElement('option')
    opt.value = key
    opt.textContent = preset.name
    if (key === activePresetKey) opt.selected = true
    select.appendChild(opt)
  }
  select.addEventListener('change', () => {
    setPreset(select.value)
    setMode('synth')
    unlockAudio().then(() => playChime(0.55, 2))
  })
}

function onPointerMove(e) {
  const x = e.clientX ?? e.touches?.[0]?.clientX
  const y = e.clientY ?? e.touches?.[0]?.clientY
  if (x == null || y == null) return
  const dx = x - pointer.x
  const dy = y - pointer.y
  pointer.vx = dx
  pointer.vy = dy
  pointer.speed = Math.hypot(dx, dy)
  pointer.x = x
  pointer.y = y
  pointer.active = true
}

function onPointerLeave() {
  pointer.active = false
  pointer.speed = 0
  pointer.vx = 0
  pointer.vy = 0
  pointer.x = -9999
  pointer.y = -9999
}

function nearestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const len2 = abx * abx + aby * aby || 1
  let t = ((px - ax) * abx + (py - ay) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  return { x: ax + abx * t, y: ay + aby * t }
}

function tick() {
  const motion = pointer.speed < MOTION_DEADZONE ? 0 : Math.min(1, pointer.speed / MOTION_REF)

  columns.forEach((col) => {
    if (!col.chars.length) return
    const top = col.chars[0]
    const bottom = col.chars[col.chars.length - 1]
    let gust = 0
    let near = false

    if (pointer.active) {
      const nearest = nearestPointOnSegment(pointer.x, pointer.y, top.x, top.y, bottom.x, bottom.y)
      const dist = Math.hypot(pointer.x - nearest.x, pointer.y - nearest.y)
      if (dist < INFLUENCE_RADIUS) {
        near = true
        if (motion > 0) {
          const influence = 1 - dist / INFLUENCE_RADIUS
          gust = (pointer.vx / MOTION_REF) * influence * GUST_SPEED
        }
      }
    }

    col.angularVel += gust
    col.angularVel -= col.angle * ANGLE_SPRING
    col.angularVel *= ANGLE_DAMPING
    col.angle += col.angularVel
    col.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, col.angle))

    if (col.held && !near) {
      const intensity = Math.min(1, Math.abs(col.angle) / MAX_ANGLE + Math.abs(col.angularVel) * 4)
      if (Math.abs(col.angle) > RELEASE_MIN_ANGLE || Math.abs(col.angularVel) > 0.01) {
        playChime(intensity, columns.indexOf(col))
      }
    }
    col.held = near
    col.el.classList.toggle('is-swaying', (near && motion > 0) || Math.abs(col.angle) > 0.06)

    const spacing =
      col.chars.length > 1
        ? Math.hypot(col.chars[1].homeX - col.chars[0].homeX, col.chars[1].homeY - col.chars[0].homeY)
        : 22

    col.chars.forEach((p, i) => {
      const depth = i + 1
      const tip = i / Math.max(col.chars.length - 1, 1)
      const arcX = Math.sin(col.angle) * spacing * depth
      const arcY = (1 - Math.cos(col.angle)) * spacing * depth
      let targetX = p.homeX + arcX
      let targetY = p.homeY + arcY

      if (pointer.active && motion > 0) {
        const dx = p.x - pointer.x
        const dy = p.y - pointer.y
        const dist = Math.hypot(dx, dy)
        if (dist < INFLUENCE_RADIUS && dist > 0.5) {
          const push = (1 - dist / INFLUENCE_RADIUS) ** 2 * motion
          targetX += (dx / dist) * push * (PUSH_BASE + tip * PUSH_TIP)
          targetY += (dy / dist) * push * (PUSH_Y_BASE + tip * PUSH_Y_TIP)
          p.el.classList.add('is-near')
        } else {
          p.el.classList.remove('is-near')
        }
      } else {
        p.el.classList.remove('is-near')
      }

      p.vx = (p.vx + (targetX - p.x) * SPRING) * DAMPING
      p.vy = (p.vy + (targetY - p.y) * SPRING) * DAMPING
      p.x += p.vx
      p.y += p.vy
      p.el.style.transform = `translate(${p.x - p.homeX}px, ${p.y - p.homeY}px) rotate(${col.angle * tip * TWIST_DEG}deg)`
    })
  })

  if (!pointer.active) {
    columns.forEach((col, colIndex) => {
      if (!col.held) return
      const intensity = Math.min(1, Math.abs(col.angle) / MAX_ANGLE + Math.abs(col.angularVel) * 4)
      if (Math.abs(col.angle) > RELEASE_MIN_ANGLE || Math.abs(col.angularVel) > 0.01) {
        playChime(intensity, colIndex)
      }
      col.held = false
    })
  }

  if (pointer.speed < MOTION_DEADZONE) {
    pointer.speed = 0
    pointer.vx = 0
    pointer.vy = 0
  } else {
    pointer.speed *= SPEED_DECAY
    pointer.vx *= SPEED_DECAY
    pointer.vy *= SPEED_DECAY
  }

  requestAnimationFrame(tick)
}

function bindEvents() {
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('pointerdown', () => unlockAudio())
  window.addEventListener(
    'touchstart',
    (e) => {
      unlockAudio()
      onPointerMove(e)
    },
    { passive: true },
  )
  window.addEventListener('touchmove', onPointerMove, { passive: true })
  let measureQueued = false
  const queueMeasure = () => {
    if (measureQueued) return
    measureQueued = true
    requestAnimationFrame(() => {
      measureQueued = false
      measureHomes()
    })
  }
  window.addEventListener('resize', queueMeasure)
  window.addEventListener('scroll', queueMeasure, { passive: true })
}

/**
 * @param {any} loc
 */
export function boot(loc) {
  locale = loc
  document.documentElement.lang = loc.lang
  document.body.dataset.locale = loc.id
  document.body.classList.add(`theme-${loc.id}`)
  setPreset(loc.chimePreset)
  setMode('synth')

  const brand = document.querySelector('.brand')
  const tagline = document.querySelector('.tagline')
  if (brand) brand.textContent = loc.brand
  if (tagline) tagline.textContent = loc.tagline
  const hintEl = hint()
  if (hintEl) hintEl.textContent = loc.hint

  renderMeta()
  renderPoem()
  setupTranslateToggle()
  setupChimePicker()
  bindEvents()
  requestAnimationFrame(tick)
  document.fonts?.ready?.then(() => measureHomes())
}
