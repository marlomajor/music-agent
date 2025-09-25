import { formatNote } from "../lib/pitch.js";

const NOTE_PLACEHOLDER = '<p class="empty-state">Record to see the melody evolve.</p>';

function toggleDisabled(button, disabled) {
  if (button) {
    button.disabled = disabled;
  }
}

function formatTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = Math.min(99, totalSeconds);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(seconds).padStart(2, "0")}:${String(centiseconds).padStart(2, "0")}`;
}

export function createUiAgent() {
  const elements = {
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
    liveFeedback: document.getElementById("liveFeedback"),
    recordedAudio: document.getElementById("recordedAudio"),
    levelBar: document.getElementById("levelBar")
  };

  function setStatus(message, tone = "info") {
    if (elements.statusText) {
      elements.statusText.textContent = message;
      elements.statusText.dataset.tone = tone;
    }
  }

  function setRecordingActive(active) {
    if (elements.indicator) {
      elements.indicator.classList.toggle("is-recording", active);
    }
    if (elements.recordButton) {
      elements.recordButton.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function setTimer(ms) {
    if (elements.timer) {
      elements.timer.textContent = formatTimer(ms);
    }
  }

  function setLevel(level) {
    if (elements.levelBar) {
      const clamped = Math.min(Math.max(level, 0), 1);
      elements.levelBar.style.transform = `scaleX(${clamped})`;
    }
  }

  function showNotes(notes) {
    if (!elements.noteList) {
      return;
    }
    if (!notes.length) {
      elements.noteList.innerHTML = NOTE_PLACEHOLDER;
      return;
    }
    const recent = notes.slice(-30);
    const fragment = document.createDocumentFragment();
    for (const note of recent) {
      const chip = document.createElement("div");
      chip.className = "note-chip";
      const label = formatNote(note);
      const time = typeof note.timestamp === "number" ? `${note.timestamp.toFixed(2)}s` : "";
      chip.innerHTML = `${label}<span class="note-chip__time">${time}</span>`;
      fragment.appendChild(chip);
    }
    elements.noteList.innerHTML = "";
    elements.noteList.appendChild(fragment);
  }

  function showLiveFeedback(text) {
    if (!elements.liveFeedback) {
      return;
    }
    if (text) {
      elements.liveFeedback.textContent = text;
      elements.liveFeedback.hidden = false;
    } else {
      elements.liveFeedback.hidden = true;
      elements.liveFeedback.textContent = "";
    }
  }

  function setRecordingUrl(url) {
    if (!elements.recordedAudio) {
      return;
    }
    if (url) {
      elements.recordedAudio.hidden = false;
      elements.recordedAudio.src = url;
      elements.recordedAudio.load();
    } else {
      elements.recordedAudio.hidden = true;
      elements.recordedAudio.src = "";
    }
  }

  function reset({ preserveAudio = false } = {}) {
    setStatus("Press Record when ready →");
    setRecordingActive(false);
    setTimer(0);
    setLevel(0);
    showLiveFeedback("");
    showNotes([]);
    toggleDisabled(elements.recordButton, false);
    toggleDisabled(elements.stopButton, true);
    toggleDisabled(elements.clearButton, false);
    toggleDisabled(elements.playButton, true);
    toggleDisabled(elements.analyzeButton, true);
    if (!preserveAudio) {
      setRecordingUrl(null);
    }
  }

  function setPlaybackEnabled(enabled) {
    toggleDisabled(elements.playButton, !enabled);
  }

  function setAnalysisEnabled(enabled) {
    toggleDisabled(elements.analyzeButton, !enabled);
  }

  function setRecordEnabled(enabled) {
    toggleDisabled(elements.recordButton, !enabled);
  }

  function setStopEnabled(enabled) {
    toggleDisabled(elements.stopButton, !enabled);
  }

  function setClearEnabled(enabled) {
    toggleDisabled(elements.clearButton, !enabled);
  }

  return {
    elements,
    setStatus,
    setRecordingActive,
    setTimer,
    setLevel,
    showNotes,
    showLiveFeedback,
    setRecordingUrl,
    reset,
    setPlaybackEnabled,
    setAnalysisEnabled,
    setRecordEnabled,
    setStopEnabled,
    setClearEnabled
  };
}
