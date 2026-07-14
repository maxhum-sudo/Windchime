/**
 * Melodic windchime engine.
 *
 * Two ways to get variety:
 * 1. Synth presets below (always available) — pick via CHIME_PRESET or the UI.
 * 2. Drop short one-shot MP3/WAV files into public/sounds/chimes/ and list them
 *    in SAMPLE_BANK. On release we pick a random buffer (or map by note).
 *
 * Good free sample sources (CC0): BigSoundBank “Dream” / “Butterfly” chimes
 *   https://bigsoundbank.com/search?q=chime
 */

/** @typedef {{ name: string, scale: number[], attack: number, decay: number, brightness: number, metal: number }} ChimePreset */

/** Frequency ratios relative to a root (Hz applied at play time). */
export const PRESETS = /** @type {Record<string, ChimePreset>} */ ({
  // Soft Asian-feel pentatonic — default, most “windchime”
  pentatonic: {
    name: 'Pentatonic',
    scale: [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2],
    attack: 0.008,
    decay: 1.8,
    brightness: 0.55,
    metal: 0.35,
  },
  // Koshi-ish: A D F G A …
  koshi: {
    name: 'Koshi',
    scale: [1, 4 / 3, 8 / 5, 16 / 9, 2, 8 / 3, 16 / 5, 4],
    attack: 0.01,
    decay: 2.2,
    brightness: 0.45,
    metal: 0.28,
  },
  // Brighter major triad stack
  major: {
    name: 'Major',
    scale: [1, 5 / 4, 3 / 2, 2, 5 / 2, 3, 15 / 4, 4],
    attack: 0.006,
    decay: 1.4,
    brightness: 0.7,
    metal: 0.4,
  },
  // High crystalline bells
  crystal: {
    name: 'Crystal',
    scale: [1, 3 / 2, 2, 3, 4, 6, 8],
    attack: 0.004,
    decay: 2.6,
    brightness: 0.85,
    metal: 0.5,
  },
  // Deep temple tubes
  temple: {
    name: 'Temple',
    scale: [1, 6 / 5, 4 / 3, 3 / 2, 8 / 5, 2],
    attack: 0.02,
    decay: 2.8,
    brightness: 0.3,
    metal: 0.22,
  },
})

/** Active synth preset key — change this, or use the on-page select. */
export let activePresetKey = 'pentatonic'

/** Root pitch in Hz for the lowest tube. */
export let ROOT_HZ = 392 // G4 — raise for brighter set, lower for deeper

/**
 * Optional sample bank. Put files in public/sounds/chimes/ then list them here.
 * Example: ['dream-1.mp3', 'dream-2.mp3', 'butterfly-1.mp3']
 * Leave empty to use synth only.
 */
export const SAMPLE_BANK = /** @type {string[]} */ ([])

/** 'synth' | 'samples' | 'blend' (synth + occasional sample if loaded) */
export let activeMode = 'synth'

/** @type {AudioContext | null} */
let ctx = null
/** @type {Map<string, AudioBuffer>} */
const sampleBuffers = new Map()
let lastNoteIndex = -1

export function setPreset(key) {
  if (PRESETS[key]) activePresetKey = key
}

export function setMode(mode) {
  if (mode === 'synth' || mode === 'samples' || mode === 'blend') activeMode = mode
}

export function setRootHz(hz) {
  ROOT_HZ = hz
}

/**
 * @param {AudioContext} audioCtx
 */
export async function initChimes(audioCtx) {
  ctx = audioCtx
  const loads = SAMPLE_BANK.map(async (file) => {
    try {
      const res = await fetch(`/sounds/chimes/${file}`)
      if (!res.ok) return
      const arr = await res.arrayBuffer()
      const buf = await audioCtx.decodeAudioData(arr)
      sampleBuffers.set(file, buf)
    } catch (err) {
      console.warn('Chime sample failed to load:', file, err)
    }
  })
  await Promise.all(loads)
}

/**
 * Play one melodic chime hit.
 * @param {number} intensity 0–1
 * @param {number} [noteHint] optional preferred scale degree
 */
export function playMelodicChime(intensity = 0.5, noteHint) {
  if (!ctx) return
  const preset = PRESETS[activePresetKey] ?? PRESETS.pentatonic
  const useSample =
    (activeMode === 'samples' || (activeMode === 'blend' && Math.random() < 0.45)) &&
    sampleBuffers.size > 0

  if (useSample) {
    playSample(intensity)
    return
  }
  playSynth(preset, intensity, noteHint)
}

function pickScaleIndex(preset, noteHint) {
  if (typeof noteHint === 'number' && Number.isFinite(noteHint)) {
    return ((Math.floor(noteHint) % preset.scale.length) + preset.scale.length) % preset.scale.length
  }
  // Prefer stepwise motion over total randomness — more melodic
  if (lastNoteIndex < 0) {
    lastNoteIndex = Math.floor(Math.random() * preset.scale.length)
    return lastNoteIndex
  }
  const step = Math.random() < 0.7 ? (Math.random() < 0.5 ? -1 : 1) : Math.floor(Math.random() * 3) - 1
  lastNoteIndex = (lastNoteIndex + step + preset.scale.length) % preset.scale.length
  return lastNoteIndex
}

/**
 * @param {ChimePreset} preset
 * @param {number} intensity
 * @param {number} [noteHint]
 */
function playSynth(preset, intensity, noteHint) {
  if (!ctx) return
  const t0 = ctx.currentTime
  const idx = pickScaleIndex(preset, noteHint)
  const freq = ROOT_HZ * preset.scale[idx]
  const vol = Math.min(0.7, 0.18 + intensity * 0.5)
  const dur = preset.decay * (0.75 + intensity * 0.4)

  const master = ctx.createGain()
  master.gain.setValueAtTime(0, t0)
  master.gain.linearRampToValueAtTime(vol, t0 + preset.attack)
  master.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  master.connect(ctx.destination)

  // Fundamental + inharmonic partials (metallic tube)
  const partials = [
    { mul: 1, gain: 1 },
    { mul: 2.76, gain: 0.35 * preset.brightness },
    { mul: 5.4, gain: 0.18 * preset.brightness },
    { mul: 8.93, gain: 0.1 * preset.metal },
    { mul: 0.5, gain: 0.22 * (1 - preset.brightness * 0.4) },
  ]

  for (const p of partials) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq * p.mul, t0)
    // Slight detune for shimmer
    osc.detune.setValueAtTime((Math.random() - 0.5) * 8, t0)
    g.gain.setValueAtTime(p.gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur * (0.6 + Math.random() * 0.4))
    osc.connect(g)
    g.connect(master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  // Soft strike transient
  const strikeDur = 0.04
  const noiseBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * strikeDur), ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq * (2.5 + preset.brightness)
  bp.Q.value = 2
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.15 * preset.metal * intensity, t0)
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + strikeDur)
  noise.connect(bp)
  bp.connect(ng)
  ng.connect(master)
  noise.start(t0)
  noise.stop(t0 + strikeDur + 0.02)
}

/**
 * @param {number} intensity
 */
function playSample(intensity) {
  if (!ctx || sampleBuffers.size === 0) return
  const files = [...sampleBuffers.keys()]
  const file = files[Math.floor(Math.random() * files.length)]
  const buf = sampleBuffers.get(file)
  if (!buf) return

  const src = ctx.createBufferSource()
  src.buffer = buf
  // Map across a gentle pitch spread for melody without mangling the sample
  const rates = [0.84, 0.89, 0.94, 1, 1.06, 1.12, 1.19]
  src.playbackRate.value = rates[Math.floor(Math.random() * rates.length)]

  const gain = ctx.createGain()
  const vol = Math.min(0.75, 0.2 + intensity * 0.55)
  const t0 = ctx.currentTime
  const dur = Math.min(buf.duration / src.playbackRate.value, 2.5)
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur)

  src.connect(gain)
  gain.connect(ctx.destination)
  src.start(t0)
  src.stop(t0 + dur + 0.05)
}
