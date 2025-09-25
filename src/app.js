import { Factory } from "https://cdn.jsdelivr.net/npm/vexflow@4.2.5/build/esm/vexflow.js";
import * as Tone from "https://cdn.jsdelivr.net/npm/tone@14.8.55/build/Tone.js";
import {
  detectPitch,
  frequencyToMidi,
  midiToNote,
  formatNote,
  mergeNotes,
  calculateRms
} from "./lib/pitch.js";
import { summarizeMelody } from "./lib/llm.js";

const ui = {
  recordButton: document.getElementById("recordButton"),
  stopButton: document.getElementById("stopButton"),
  clearButton: document.getElementById("clearButton"),
  playButton: document.getElementById("playButton"),
  analyzeButton: document.getElementById("analyzeButton"),
  apiKey: document.getElementById("apiKey"),
  statusText: document.getElementById("statusText"),
  indicator: document.getElementById("recordingIndicator"),
  timer: document.getElementById("timer"),
  noteList: document.getElementById("noteList"),
  sheet: document.getElementById("sheet"),
  llmJson: document.getElementById("llmJson"),
  llmExplanation: document.getElementById("llmExplanation"),
  recordedAudio: document.getElementById("recordedAudio"),
  levelBar: document.getElementById("levelBar")
};

const state = {
  audioContext: null,
  analyser: null,
  buffer: null,
  detectionInterval: null,
  timerInterval: null,
  autoStopTimeout: null,
  recordingStart: 0,
  mediaStream: null,
  mediaRecorder: null,
  recordedChunks: [],
  recordingUrl: null,
  notes: [],
  isRecording: false
};

function setStatus(message, tone = "info") {
  ui.statusText.textContent = message;
  ui.statusText.dataset.tone = tone;
}

function toggleRecordingIndicator(active) {
  ui.indicator.classList.toggle("is-recording", active);
  ui.recordButton.setAttribute("aria-pressed", active ? "true" : "false");
}

function resetState({ preserveAudio = false } = {}) {
  if (!preserveAudio && state.recordingUrl) {
    URL.revokeObjectURL(state.recordingUrl);
    state.recordingUrl = null;
  }

  state.notes = [];
  ui.noteList.innerHTML = '<p class="empty-state">Record to see the melody evolve in real time.</p>';
  ui.playButton.disabled = true;
  ui.analyzeButton.disabled = true;
  ui.llmJson.textContent = '{"status": "Waiting for analysis"}';
  ui.llmExplanation.textContent = "Add a short melody to receive a key, chords, and style guidance.";
  ui.timer.textContent = "00:00";
  updateLevelMeter(0);
  clearSheetMusic();
  setStatus("Idle. Ready when you are.");
}

function updateLevelMeter(level) {
  const clamped = Math.min(Math.max(level, 0), 1);
  ui.levelBar.style.transform = `scaleX(${clamped})`;
}

function updateTimer() {
  const elapsed = (performance.now() - state.recordingStart) / 1000;
  const seconds = Math.max(0, Math.min(99, Math.floor(elapsed)));
  const centiseconds = Math.floor((elapsed % 1) * 100);
  ui.timer.textContent = `${String(seconds).padStart(2, "0")}:${String(centiseconds).padStart(2, "0")}`;
}

async function startRecording() {
  if (state.isRecording) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Microphone access isn't supported in this browser.", "error");
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    setStatus("Web Audio API is not available in this browser.", "error");
    return;
  }

  if (!window.MediaRecorder) {
    setStatus("MediaRecorder is not supported here. Try Chrome or Edge.", "error");
    return;
  }

  setStatus("Requesting microphone permission...");
  ui.recordButton.disabled = true;
  ui.stopButton.disabled = true;
  ui.clearButton.disabled = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    });

    resetState();

    const audioContext = new AudioContext({ latencyHint: "interactive" });
    await audioContext.resume();

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.4;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);

    const mediaRecorder = new MediaRecorder(stream);
    state.recordedChunks = [];
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        state.recordedChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", () => {
      if (state.recordedChunks.length === 0) {
        return;
      }
      if (state.recordingUrl) {
        URL.revokeObjectURL(state.recordingUrl);
      }
      const blob = new Blob(state.recordedChunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      state.recordingUrl = url;
      ui.recordedAudio.hidden = false;
      ui.recordedAudio.src = url;
      ui.recordedAudio.load();
    });

    mediaRecorder.start();

    state.audioContext = audioContext;
    state.analyser = analyser;
    state.buffer = buffer;
    state.mediaStream = stream;
    state.mediaRecorder = mediaRecorder;
    state.isRecording = true;
    state.recordingStart = performance.now();

    if (state.autoStopTimeout) {
      clearTimeout(state.autoStopTimeout);
    }
    state.autoStopTimeout = window.setTimeout(() => {
      stopRecording();
    }, 12000);

    ui.stopButton.disabled = false;
    ui.clearButton.disabled = false;
    toggleRecordingIndicator(true);
    setStatus("Recording... hum for a few seconds.", "success");

    state.timerInterval = window.setInterval(updateTimer, 75);

    state.detectionInterval = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const { frequency, clarity } = detectPitch(buffer, audioContext.sampleRate);
      const rms = calculateRms(buffer) * 3.2;
      updateLevelMeter(Math.min(rms, 1));

      if (!frequency || clarity < 0.58) {
        return;
      }

      const midi = frequencyToMidi(frequency);
      if (midi === null) {
        return;
      }

      const note = midiToNote(midi);
      if (!note) {
        return;
      }

      const timestamp = Number((audioContext.currentTime).toFixed(2));
      const previous = state.notes[state.notes.length - 1];
      if (!previous || previous.midi !== note.midi) {
        state.notes.push({ ...note, frequency, clarity, timestamp });
        renderNoteList();
      }
    }, 200);
  } catch (error) {
    console.error(error);
    setStatus("Microphone permission denied. Please allow access and try again.", "error");
    cleanupRecording();
  } finally {
    ui.recordButton.disabled = state.isRecording;
    ui.stopButton.disabled = !state.isRecording;
    ui.clearButton.disabled = false;
  }
}

function stopRecording() {
  if (!state.isRecording) {
    return;
  }

  if (state.detectionInterval) {
    clearInterval(state.detectionInterval);
    state.detectionInterval = null;
  }

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  if (state.autoStopTimeout) {
    clearTimeout(state.autoStopTimeout);
    state.autoStopTimeout = null;
  }

  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }

  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach((track) => track.stop());
    state.mediaStream = null;
  }

  if (state.audioContext && state.audioContext.state !== "closed") {
    state.audioContext.close();
    state.audioContext = null;
  }

  state.isRecording = false;
  toggleRecordingIndicator(false);
  updateLevelMeter(0);

  state.notes = mergeNotes(state.notes);

  if (state.notes.length) {
    setStatus("Recording captured. Preview your melody below.", "success");
    ui.playButton.disabled = false;
    ui.analyzeButton.disabled = false;
    renderSheetMusic();
  } else {
    setStatus("No stable pitch detected. Try a clearer hum.", "warning");
    ui.noteList.innerHTML = '<p class="empty-state">Try again with a steady pitch.</p>';
  }

  ui.recordButton.disabled = false;
  ui.stopButton.disabled = true;
}

function cleanupRecording() {
  if (state.detectionInterval) {
    clearInterval(state.detectionInterval);
    state.detectionInterval = null;
  }

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  if (state.autoStopTimeout) {
    clearTimeout(state.autoStopTimeout);
    state.autoStopTimeout = null;
  }

  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    try {
      state.mediaRecorder.stop();
    } catch (error) {
      console.warn("Unable to stop recorder", error);
    }
  }

  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach((track) => track.stop());
    state.mediaStream = null;
  }

  if (state.audioContext && state.audioContext.state !== "closed") {
    state.audioContext.close();
    state.audioContext = null;
  }

  state.isRecording = false;
  toggleRecordingIndicator(false);
  updateLevelMeter(0);
  ui.recordButton.disabled = false;
  ui.stopButton.disabled = true;
}

function clearSession() {
  cleanupRecording();
  if (state.mediaRecorder) {
    state.mediaRecorder = null;
  }
  if (state.recordingUrl) {
    URL.revokeObjectURL(state.recordingUrl);
    state.recordingUrl = null;
  }
  ui.recordedAudio.hidden = true;
  ui.recordedAudio.src = "";
  resetState();
}

function renderNoteList() {
  if (!state.notes.length) {
    ui.noteList.innerHTML = '<p class="empty-state">Listening... hold a steady pitch.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const note of state.notes.slice(-30)) {
    const chip = document.createElement("div");
    chip.className = "note-chip";
    chip.innerHTML = `${formatNote(note)}<span class="note-chip__time">${note.timestamp.toFixed(2)}s</span>`;
    fragment.appendChild(chip);
  }

  ui.noteList.innerHTML = "";
  ui.noteList.appendChild(fragment);
}

function clearSheetMusic() {
  if (ui.sheet) {
    ui.sheet.innerHTML = "";
  }
}

function renderSheetMusic() {
  clearSheetMusic();
  if (!state.notes.length) {
    return;
  }

  const width = Math.max(420, state.notes.length * 70);
  const height = 220;
  const factory = new Factory({ renderer: { elementId: "sheet", width, height } });
  const score = factory.EasyScore();
  const system = factory.System();

  const vexNotes = state.notes
    .map((note) => {
      const key = `${note.name.toLowerCase().replace("#", "#")}/${note.octave}`;
      return `${key}/q`;
    })
    .join(", ");

  system
    .addStave({
      voices: [
        score.voice(score.notes(vexNotes || "b/4/q", { stem: "up" }))
      ]
    })
    .addClef("treble")
    .addTimeSignature("4/4");

  factory.draw();
}

async function playMelody() {
  if (!state.notes.length) {
    return;
  }

  await Tone.start();
  const synth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, release: 0.4 }
  }).toDestination();
  const now = Tone.now();
  const step = 0.5;

  state.notes.forEach((note, index) => {
    const toneNote = Tone.Frequency(note.midi, "midi").toNote();
    synth.triggerAttackRelease(toneNote, "8n", now + index * step);
  });

  setStatus("Playing melody preview...", "info");
}

async function analyzeMelody() {
  if (!state.notes.length) {
    return;
  }

  ui.analyzeButton.disabled = true;
  ui.llmJson.textContent = "Analyzing...";
  ui.llmExplanation.textContent = "Contacting the language model...";

  const apiKey = ui.apiKey.value.trim();
  const noteSequence = state.notes.map((note) => formatNote(note));

  let payload;
  if (!apiKey) {
    payload = summarizeMelody(noteSequence);
  } else {
    try {
      payload = await callOpenAI(apiKey, noteSequence);
    } catch (error) {
      console.error(error);
      setStatus("LLM call failed, falling back to heuristic.", "warning");
      payload = summarizeMelody(noteSequence);
    }
  }

  ui.llmJson.textContent = JSON.stringify(payload, null, 2);
  ui.llmExplanation.textContent = payload.explanation;
  ui.analyzeButton.disabled = false;
}

async function callOpenAI(apiKey, noteSequence) {
  const prompt = `Given the note sequence ${JSON.stringify(
    noteSequence
  )}, determine the most likely musical key. Suggest a style this fits in, and possible chords to harmonize. Respond with JSON containing keys: likely_key, style, suggested_chords (array), and explanation.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful music theory assistant. Always respond with valid JSON."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.choices?.length) {
    throw new Error("No choices returned from OpenAI API");
  }

  return JSON.parse(data.choices[0].message.content);
}

function bindEvents() {
  ui.recordButton.addEventListener("click", startRecording, { passive: true });
  ui.stopButton.addEventListener("click", stopRecording, { passive: true });
  ui.clearButton.addEventListener("click", clearSession, { passive: true });
  ui.playButton.addEventListener("click", playMelody, { passive: true });
  ui.analyzeButton.addEventListener("click", analyzeMelody, { passive: true });

  window.addEventListener("beforeunload", () => {
    cleanupRecording();
    if (state.recordingUrl) {
      URL.revokeObjectURL(state.recordingUrl);
    }
  });
}

bindEvents();
resetState({ preserveAudio: true });
