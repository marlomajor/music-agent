export function createAgentState() {
  return {
    audioContext: null,
    analyser: null,
    buffer: null,
    detectionInterval: null,
    timerInterval: null,
    autoStopTimeout: null,
    recordingStartMs: 0,
    recordingStartAudio: 0,
    mediaStream: null,
    mediaRecorder: null,
    recordedChunks: [],
    recordingUrl: null,
    notes: [],
    isRecording: false,
    waveCanvas: null,
    waveCtx: null,
    waveAnimation: null
  };
}
