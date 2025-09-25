# Song Agent – Sing to Sheet Music

A browser-based AI demo where you can hum a short melody and immediately get:

- The detected pitch sequence shown as note names
- Simplified sheet music rendered with VexFlow
- Playback of the melody with Tone.js
- An LLM interpretation that explains the most likely key, suggested chords, and stylistic notes

This project demonstrates how an agent can coordinate live audio analysis, symbolic music rendering, playback, and large language model reasoning to produce a cohesive experience.

## Features

- **Live audio capture** using the Web Audio API (5–10 seconds at a time).
- **Pitch detection** with [Pitchy](https://github.com/charlieroberts/pitchy) to map dominant frequencies to MIDI notes.
- **Sheet music rendering** with VexFlow, quantized as quarter notes for an easy-to-read staff.
- **Playback** of the detected melody using Tone.js.
- **LLM explanation** via OpenAI's Chat Completions API (with an offline heuristic fallback when no key is supplied).

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer (npm is bundled with Node).
- A modern browser (Chrome, Edge, or Safari) with microphone access.

## Quick start

1. Install dependencies (none are required, but this creates a local `node_modules` directory and ensures npm scripts are available):
   ```bash
   npm install
   ```
2. Launch the built-in static file server:
   ```bash
   npm start
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000). You can change the port by setting the `PORT` environment variable before running the command.
3. Visit the URL in your browser and allow microphone access when prompted.

## Usage

1. Click **Record** and hum a simple melody for up to 10 seconds.
2. Click **Stop** to finalize capture. The detected notes, sheet music, and playback controls will become active.
3. (Optional) Paste an OpenAI API key and click **Analyze Melody** to get an LLM-generated explanation. Without a key the app uses a deterministic heuristic to provide a sample response.
4. Press **Play Melody** to hear the quantized playback of your tune.

## Notes and limitations

- The pitch detector is tuned for monophonic input and may misinterpret noisy environments or complex harmonies.
- Durations are simplified to a steady pulse so the sheet music is readable without rhythm transcription.
- API calls are client-side only; keep your key private and be mindful of usage costs.
- If microphone access fails, try using the site over HTTPS or fall back to a pre-recorded audio file (not included in this demo).

## License

MIT
