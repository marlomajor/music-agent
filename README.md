# Music Agent

Hum melody in your browser, see live notes, get sheet music, and play it back etc

## Features
- Record audio (auto-stops after ~12s)
- Real-time pitch detection → MIDI notes
- Sheet music with VexFlow (Did not finish)
- Playback with Tone.js + raw clip
- Optional LLM analysis of key & chords

## Quick Start
```bash
npm install
npm start
Open http://localhost:3000, allow mic access, and record.
```

## Usage

- Click Record and hum a tune
- Stop → see notes + sheet music
- Play back or analyze with API key