import { createAgentState } from "./agents/state.js";
import { createUiAgent } from "./agents/ui-agent.js";
import { createRecorderAgent } from "./agents/recorder-agent.js";
import { createPlaybackAgent } from "./agents/playback-agent.js";
import { createInsightAgent } from "./agents/insight-agent.js";

const tone = window.Tone;
const state = createAgentState();
const ui = createUiAgent();
const recorder = createRecorderAgent({
  state,
  ui,
  onNotesChange: (notes) => {
    ui.showNotes(notes);
  }
});
const playback = createPlaybackAgent(tone);
const insights = createInsightAgent({ ui });

ui.reset({ preserveAudio: true });

ui.elements.recordButton?.addEventListener("click", () => {
  recorder.start();
});

ui.elements.stopButton?.addEventListener("click", () => {
  recorder.stop();
});

ui.elements.clearButton?.addEventListener("click", () => {
  recorder.clear();
  ui.reset();
});

ui.elements.playButton?.addEventListener("click", () => {
  const notes = recorder.getNotes();
  playback.play(notes);
  ui.setStatus("Playing melody preview...", "info");
});

ui.elements.analyzeButton?.addEventListener("click", async () => {
  const notes = recorder.getNotes();
  if (!notes.length) {
    return;
  }
  ui.setAnalysisEnabled(false);
  try {
    const apiKey = ui.elements.apiKey?.value?.trim() || "";
    await insights.analyze(notes, apiKey);
  } finally {
    ui.setAnalysisEnabled(true);
  }
});

window.addEventListener("beforeunload", () => {
  recorder.cleanup();
  if (state.recordingUrl) {
    URL.revokeObjectURL(state.recordingUrl);
    state.recordingUrl = null;
  }
});
