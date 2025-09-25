# Song Agent – Sing to Sheet Music

A browser-based AI demo where you can hum a short melody and immediately get sleek, enterprise-style feedback:

- Real-time level metering while you record so you know the mic is live.
- A scroll of detected notes that updates every 200ms.
- Simplified sheet music rendered with VexFlow once you stop.
- Playback of the melody with Tone.js and a stored audio clip of your raw take.
- An LLM interpretation that explains the most likely key, suggested chords, and stylistic notes.

This project demonstrates how an agent can coordinate live audio analysis, symbolic music rendering, playback, and large language model reasoning to produce a cohesive experience.

## Features

- **Live audio capture** using the Web Audio API with built-in auto stop after ~12 seconds.
- **Custom autocorrelation pitch detection** to map dominant frequencies to MIDI notes.
- **Sheet music rendering** with VexFlow, quantized as quarter notes for an easy-to-read staff.
- **Playback** of the detected melody using Tone.js plus an audio preview of the captured clip.
- **LLM explanation** via OpenAI's Chat Completions API (with an offline heuristic fallback when no key is supplied).
- **Single-command testing** with Node's native test runner to verify pitch utilities and the heuristic summarizer.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer (npm is bundled with Node).
- A modern browser (Chrome, Edge, or Safari) with microphone access.

## Quick start

1. Install dependencies (none are required, but this generates a fresh `package-lock.json` and keeps npm happy):
   ```bash
   npm install
   ```
2. Launch the built-in static file server:
   ```bash
   npm start
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000). You can change the port by setting the `PORT` environment variable before running the command.
3. Visit the URL in your browser and allow microphone access when prompted. You should see the level meter react immediately when audio is flowing.

## Usage

1. Click **Record** and hum a simple melody. The timer, status light, and level meter confirm that audio is being captured.
2. Click **Stop** (or wait for the auto stop) to finalize capture. The detected notes, sheet music, and playback controls will become active, and an audio clip of the take will be saved below the recorder.
3. (Optional) Paste an OpenAI API key and click **Analyze Melody** to get an LLM-generated explanation. Without a key the app uses a deterministic heuristic to provide a sample response.
4. Press **Play Melody** to hear the quantized playback of your tune.

## Testing

Run the lightweight regression tests at any time:

```bash
npm test
```

These checks confirm the pitch detector correctly recognises a 440Hz tone, validate MIDI and note conversion helpers, and ensure the heuristic LLM fallback produces consistent guidance.

## Notes and limitations

- The pitch detector is tuned for monophonic input and may misinterpret noisy environments or complex harmonies.
- Durations are simplified to a steady pulse so the sheet music is readable without rhythm transcription.
- API calls are client-side only; keep your key private and be mindful of usage costs.
- If microphone access fails, try using the site over HTTPS or fall back to a pre-recorded audio file (not included in this demo).

## License

MIT
