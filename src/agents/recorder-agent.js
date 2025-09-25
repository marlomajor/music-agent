import {
  detectPitch,
  frequencyToMidi,
  midiToNote,
  mergeNotes,
  calculateRms
} from "../lib/pitch.js";
import { startVisualizer, stopVisualizer } from "./visualizer-agent.js";

function stopTimer(state) {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function stopDetection(state) {
  if (state.detectionInterval) {
    clearInterval(state.detectionInterval);
    state.detectionInterval = null;
  }
}

function clearAutoStop(state) {
  if (state.autoStopTimeout) {
    clearTimeout(state.autoStopTimeout);
    state.autoStopTimeout = null;
  }
}

function closeAudio(state) {
  if (state.audioContext && state.audioContext.state !== "closed") {
    state.audioContext.close();
  }
  state.audioContext = null;
  state.analyser = null;
  state.buffer = null;
}

function stopStream(state) {
  if (state.mediaStream) {
    for (const track of state.mediaStream.getTracks()) {
      track.stop();
    }
  }
  state.mediaStream = null;
}

function stopRecorder(state) {
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }
  state.mediaRecorder = null;
}

function updateNotes(state, onNotesChange) {
  if (onNotesChange) {
    onNotesChange([...state.notes]);
  }
}

async function requestStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  } catch (_error) {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

export function createRecorderAgent({ state, ui, onNotesChange, onRecordingReady }) {
  async function start() {
    if (state.isRecording) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      ui.setStatus("Microphone access isn't supported in this browser.", "error");
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      ui.setStatus("Web Audio API is not available in this browser.", "error");
      return;
    }
    if (!window.MediaRecorder) {
      ui.setStatus("MediaRecorder is not supported here. Try Chrome or Edge.", "error");
      return;
    }
    ui.setStatus("Requesting microphone permission...");
    ui.setRecordEnabled(false);
    ui.setStopEnabled(true);
    ui.setClearEnabled(false);
    try {
      const stream = await requestStream();
      state.audioContext = new AudioContextClass({ latencyHint: "interactive" });
      await state.audioContext.resume();
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 2048;
      state.analyser.smoothingTimeConstant = 0.4;
      const source = state.audioContext.createMediaStreamSource(stream);
      source.connect(state.analyser);
      state.buffer = new Float32Array(state.analyser.fftSize);
      state.mediaRecorder = new MediaRecorder(stream);
      state.recordedChunks = [];
      state.mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          state.recordedChunks.push(event.data);
        }
      });
      state.mediaRecorder.addEventListener("stop", () => {
        if (!state.recordedChunks.length) {
          return;
        }
        if (state.recordingUrl) {
          URL.revokeObjectURL(state.recordingUrl);
        }
        const blob = new Blob(state.recordedChunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        state.recordingUrl = url;
        ui.setRecordingUrl(url);
        if (onRecordingReady) {
          onRecordingReady(url);
        }
      });
      state.mediaRecorder.start();
      state.mediaStream = stream;
      state.notes = [];
      updateNotes(state, onNotesChange);
      state.isRecording = true;
      state.recordingStartMs = performance.now();
      state.recordingStartAudio = state.audioContext.currentTime;
      startVisualizer(state, state.analyser);
      ui.setRecordingActive(true);
      ui.setStatus("Recording... hum for a few seconds.", "success");
      ui.setStopEnabled(true);
      ui.setClearEnabled(false);
      ui.setPlaybackEnabled(false);
      ui.setAnalysisEnabled(false);
      ui.showLiveFeedback("");
      state.timerInterval = setInterval(() => {
        const elapsed = performance.now() - state.recordingStartMs;
        ui.setTimer(elapsed);
      }, 75);
      state.detectionInterval = setInterval(() => {
        state.analyser.getFloatTimeDomainData(state.buffer);
        const { frequency, clarity } = detectPitch(state.buffer, state.audioContext.sampleRate);
        const level = calculateRms(state.buffer) * 3.2;
        ui.setLevel(Math.min(level, 1));
        if (!frequency || clarity < 0.4) {
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
        const timestamp = Number((state.audioContext.currentTime - state.recordingStartAudio).toFixed(2));
        const previous = state.notes[state.notes.length - 1];
        const isNewPitch = !previous || previous.midi !== note.midi;
        const isTimeGap = !previous || Math.abs(timestamp - previous.timestamp) > 0.35;
        if (isNewPitch || isTimeGap) {
          state.notes.push({ ...note, frequency, clarity, timestamp });
          if (state.notes.length > 40) {
            state.notes.shift();
          }
          updateNotes(state, onNotesChange);
        }
      }, 200);
      state.autoStopTimeout = setTimeout(() => {
        stop();
      }, 12000);
    } catch (error) {
      console.error("Microphone error", error);
      ui.setStatus("Unable to start microphone. Check browser permissions and refresh.", "error");
      cleanup();
    } finally {
      if (!state.isRecording) {
        ui.setRecordEnabled(true);
        ui.setStopEnabled(false);
        ui.setClearEnabled(true);
      }
    }
  }

  function finishRecording() {
    stopDetection(state);
    stopTimer(state);
    clearAutoStop(state);
    stopRecorder(state);
    stopStream(state);
    stopVisualizer(state);
    closeAudio(state);
  }

  function stop() {
    if (!state.isRecording) {
      return;
    }
    finishRecording();
    state.isRecording = false;
    ui.setRecordingActive(false);
    ui.setRecordEnabled(true);
    ui.setStopEnabled(false);
    ui.setClearEnabled(true);
    if (!state.notes.length) {
      ui.setStatus("No stable pitch detected. Try a clearer hum.", "warning");
      state.notes = [];
      updateNotes(state, onNotesChange);
      ui.setPlaybackEnabled(false);
      ui.setAnalysisEnabled(false);
      return;
    }
    state.notes = mergeNotes(state.notes);
    updateNotes(state, onNotesChange);
    ui.setPlaybackEnabled(true);
    ui.setAnalysisEnabled(true);
    ui.setStatus("Recording captured. Preview your melody below.", "success");
  }

  function cleanup() {
    finishRecording();
    state.isRecording = false;
    ui.setRecordingActive(false);
    ui.setRecordEnabled(true);
    ui.setStopEnabled(false);
    ui.setClearEnabled(true);
  }

  function clearSession() {
    cleanup();
    if (state.recordingUrl) {
      URL.revokeObjectURL(state.recordingUrl);
      state.recordingUrl = null;
    }
    state.notes = [];
    updateNotes(state, onNotesChange);
    ui.setRecordingUrl(null);
    ui.setPlaybackEnabled(false);
    ui.setAnalysisEnabled(false);
  }

  function getNotes() {
    return [...state.notes];
  }

  return {
    start,
    stop,
    cleanup,
    clear: clearSession,
    getNotes
  };
}
