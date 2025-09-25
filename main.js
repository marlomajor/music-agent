import { Factory } from "https://cdn.jsdelivr.net/npm/vexflow@4.2.4/build/esm/vexflow.js";
import * as Tone from "https://cdn.jsdelivr.net/npm/tone@14.8.55/build/Tone.js";
import { PitchDetector } from "https://cdn.jsdelivr.net/npm/pitchy@4.0.0/dist/index.esm.js";

const recordButton = document.getElementById("recordButton");
const stopButton = document.getElementById("stopButton");
const statusEl = document.getElementById("status");
const noteListEl = document.getElementById("noteList");
const playButton = document.getElementById("playButton");
const analyzeButton = document.getElementById("analyzeButton");
const apiKeyInput = document.getElementById("apiKey");
const llmJsonEl = document.getElementById("llmJson");
const llmExplanationEl = document.getElementById("llmExplanation");

let audioContext;
let analyserNode;
let mediaStream;
let detector;
let dataArray;
let detectionInterval;
let recordingStartTime = 0;

const collectedNotes = [];
const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
playButton.addEventListener("click", playMelody);
analyzeButton.addEventListener("click", analyzeMelodyWithLLM);

function resetState() {
  collectedNotes.length = 0;
  noteListEl.textContent = "Listening...";
  playButton.disabled = true;
  analyzeButton.disabled = true;
  clearSheetMusic();
  llmJsonEl.textContent = '{"status": "Waiting for analysis"}';
  llmExplanationEl.textContent = "The explanation will appear here after analysis.";
}

async function startRecording() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
  }

  resetState();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Microphone access denied. Please allow mic permissions.";
    return;
  }

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;

  const source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(analyserNode);

  detector = PitchDetector.forFloat32Array(analyserNode.fftSize);
  dataArray = new Float32Array(analyserNode.fftSize);
  recordingStartTime = audioContext.currentTime;

  recordButton.disabled = true;
  stopButton.disabled = false;
  statusEl.textContent = "Recording... hum for up to 10 seconds.";

  detectionInterval = setInterval(() => {
    analyserNode.getFloatTimeDomainData(dataArray);
    const [pitch, clarity] = detector.findPitch(dataArray, audioContext.sampleRate);

    if (!pitch || Number.isNaN(pitch) || pitch < 60 || pitch > 1400) {
      return;
    }

    if (clarity < 0.9) {
      return;
    }

    const midi = Math.round(12 * Math.log2(pitch / 440) + 69);
    const { name, octave } = midiToNote(midi);
    const timestamp = audioContext.currentTime - recordingStartTime;

    const previous = collectedNotes[collectedNotes.length - 1];
    if (!previous || previous.midi !== midi) {
      collectedNotes.push({
        midi,
        name,
        octave,
        frequency: pitch,
        timestamp,
      });
      renderNoteList();
    }
  }, 250);
}

function stopRecording() {
  if (!mediaStream) {
    return;
  }

  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }

  mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;

  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }

  stopButton.disabled = true;
  recordButton.disabled = false;

  if (collectedNotes.length === 0) {
    statusEl.textContent = "No pitch detected. Try again in a quieter room.";
    noteListEl.textContent = "No notes captured.";
    return;
  }

  statusEl.textContent = "Recording stopped. Review the detected melody.";
  playButton.disabled = false;
  analyzeButton.disabled = false;

  renderSheetMusic(collectedNotes);
}

function renderNoteList() {
  if (collectedNotes.length === 0) {
    noteListEl.textContent = "Listening...";
    return;
  }

  const display = collectedNotes
    .map((note) => `${note.name}${note.octave}`)
    .join(" • ");
  noteListEl.textContent = display;
}

function clearSheetMusic() {
  const sheet = document.getElementById("sheet");
  if (sheet) {
    sheet.innerHTML = "";
  }
}

function renderSheetMusic(sequence) {
  clearSheetMusic();

  const sheet = document.getElementById("sheet");
  if (!sheet) return;

  if (!sequence.length) {
    return;
  }

  const width = Math.max(360, sequence.length * 70);
  const height = 200;

  const factory = new Factory({ renderer: { elementId: "sheet", width, height } });
  const score = factory.EasyScore();
  const system = factory.System();

  const vexNotes = sequence
    .map((note) => {
      const key = toVexKey(note.name, note.octave);
      return `${key}/q`;
    })
    .join(", ");

  system
    .addStave({
      voices: [
        score.voice(
          score.notes(vexNotes || "b/4/q", {
            stem: "up",
          })
        ),
      ],
    })
    .addClef("treble")
    .addTimeSignature("4/4");

  factory.draw();
}

async function playMelody() {
  if (!collectedNotes.length) {
    return;
  }

  await Tone.start();
  const synth = new Tone.Synth().toDestination();
  const now = Tone.now();
  const step = 0.5;

  collectedNotes.forEach((note, index) => {
    const toneNote = `${note.name.replace("#", "#")}${note.octave}`;
    synth.triggerAttackRelease(toneNote, "8n", now + index * step);
  });
}

async function analyzeMelodyWithLLM() {
  if (!collectedNotes.length) {
    return;
  }

  analyzeButton.disabled = true;
  llmJsonEl.textContent = "Analyzing...";
  llmExplanationEl.textContent = "Contacting the language model...";

  const apiKey = apiKeyInput.value.trim();
  const noteSequence = collectedNotes.map((note) => `${note.name}${note.octave}`);

  let responsePayload;

  if (!apiKey) {
    responsePayload = heuristicLLMResponse(noteSequence);
  } else {
    try {
      responsePayload = await callOpenAI(apiKey, noteSequence);
    } catch (error) {
      console.error(error);
      statusEl.textContent = "LLM call failed, using local heuristic.";
      responsePayload = heuristicLLMResponse(noteSequence);
    }
  }

  llmJsonEl.textContent = JSON.stringify(responsePayload, null, 2);
  llmExplanationEl.textContent = responsePayload.explanation;
  analyzeButton.disabled = false;
}

function heuristicLLMResponse(notes) {
  if (!notes.length) {
    return {
      likely_key: "C major",
      style: "ambient",
      suggested_chords: ["C", "F", "G"],
      explanation: "No notes captured, defaulting to C major as a safe guess.",
    };
  }

  const pitchCounts = new Map();
  notes.forEach((note) => {
    const pitchClass = note.replace(/\d+/g, "");
    pitchCounts.set(pitchClass, (pitchCounts.get(pitchClass) || 0) + 1);
  });

  let dominantPitch = "C";
  let maxCount = 0;
  for (const [pitch, count] of pitchCounts.entries()) {
    if (count > maxCount) {
      dominantPitch = pitch;
      maxCount = count;
    }
  }

  const possibleKeys = {
    C: { key: "C major", chords: ["C", "F", "G", "Am"], style: "folk/pop" },
    G: { key: "G major", chords: ["G", "C", "D", "Em"], style: "bluegrass" },
    D: { key: "D major", chords: ["D", "G", "A", "Bm"], style: "rock" },
    A: { key: "A major", chords: ["A", "D", "E", "F#m"], style: "country" },
    E: { key: "E minor", chords: ["Em", "C", "D", "G"], style: "indie" },
    F: { key: "F major", chords: ["F", "Bb", "C", "Dm"], style: "ballad" },
  };

  const match = possibleKeys[dominantPitch] || possibleKeys.C;

  return {
    likely_key: match.key,
    style: match.style,
    suggested_chords: match.chords,
    explanation: `Your melody emphasizes ${dominantPitch}, so ${match.key} is a natural fit with ${match.chords.join(", ")}.`,
  };
}

async function callOpenAI(apiKey, noteSequence) {
  const prompt = `Given the note sequence ${JSON.stringify(
    noteSequence
  )}, determine the most likely musical key. Suggest a style this fits in, and possible chords to harmonize. Respond with JSON containing keys: likely_key, style, suggested_chords (array), and explanation.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful music theory assistant. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.choices?.length) {
    throw new Error("No choices returned from OpenAI API");
  }

  const parsed = JSON.parse(data.choices[0].message.content);
  return parsed;
}

function midiToNote(midi) {
  const safeMidi = Math.min(Math.max(midi, 0), 127);
  const name = noteNames[safeMidi % 12];
  const octave = Math.floor(safeMidi / 12) - 1;
  return { name, octave };
}

function toVexKey(name, octave) {
  return `${name.toLowerCase().replace("#", "#")}/${octave}`;
}
