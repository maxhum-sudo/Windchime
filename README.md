# Windchime

Three cultural rooms under one brand: hanging verse as windchimes.

| Page | Roof | Poem | Script |
|------|------|------|--------|
| [`/`](index.html) | Chinese pagoda | 《春江花月夜》 · 张若虚 | 中文 |
| [`/india.html`](india.html) | Temple mandapa + kalasha | मेघदूतम् · कालिदास | देवनागरी |
| [`/cambodia.html`](cambodia.html) | Khmer multi-tier eaves | រាមកេរ្តិ៍ | ខ្មែរ |

Native scripts only — no English gloss on the poems.

## Run

```bash
npm install
npm run dev
```

## Chimes

Use the on-page **Chime** dropdown, or edit [`src/chimes.js`](src/chimes.js). Defaults: China → pentatonic, India → temple, Cambodia → crystal.

## Credits

- China: 《春江花月夜》 — 张若虚 (public domain)
- India: मेघदूतम् — कालिदास (public domain)
- Cambodia: រាមកេរ្តិ៍ — classical Khmer tradition (public domain)
- Synth chimes: Web Audio in [`src/chimes.js`](src/chimes.js)
