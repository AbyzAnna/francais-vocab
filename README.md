# Français — Vocabulaire & Entraînement

A study site for beginner French: every vocabulary word from *Unité préliminaire → Unité 4*,
plus the core grammar structures, with interactive practice.

**Live site:** _(GitHub Pages link — see repo Settings → Pages)_

## Features

- **Browse** — 544 words grouped by lesson (Prélim, 1A–4B) and theme, with live FR/EN search.
- **Train** — translation practice: French→English, English→French, or mixed; pick a lesson or
  all units; 10/20/40/all questions. Lenient checker (ignores accents, case, and parentheses),
  reveal answers, self-grade close calls, and an end-of-session review of missed words.
- **Grammar** — five structures with explanations, examples, and interactive *Essayez!* drills:
  - 1B.1 Subject pronouns and the verb *être*
  - 2A.1 Present tense of regular *-er* verbs
  - 2A.2 Forming questions and expressing negation
  - 2B.1 Present tense of *avoir*
  - 4A.1 The verb *aller* (+ *le futur proche*, prepositions with place names)

## Running locally

It's a static site — no build step. Serve the folder with any static server:

```bash
python3 -m http.server 4173
# then open http://localhost:4173
```

## Structure

| File | Purpose |
|------|---------|
| `index.html` | Page shell and the three tabs |
| `data.js` | All vocabulary + grammar data |
| `app.js` | Browse filtering, translation trainer, grammar drills |
| `styles.css` | Styling |
