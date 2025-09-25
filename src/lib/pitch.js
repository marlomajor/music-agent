const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function detectPitch(buffer, sampleRate) {
  const SIZE = buffer.length;
  if (!SIZE) {
    return { frequency: null, clarity: 0 };
  }

  let sumSquares = 0;
  for (let i = 0; i < SIZE; i++) {
    const sample = buffer[i];
    sumSquares += sample * sample;
  }

  const rootMeanSquare = Math.sqrt(sumSquares / SIZE);
  if (rootMeanSquare < 0.0025) {
    return { frequency: null, clarity: 0 };
  }

  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;

  while (r1 < SIZE / 2 && Math.abs(buffer[r1]) < threshold) {
    r1++;
  }

  while (r2 > SIZE / 2 && Math.abs(buffer[r2]) < threshold) {
    r2--;
  }

  const trimmed = buffer.slice(r1, r2);
  const trimmedSize = trimmed.length;
  if (trimmedSize < 2) {
    return { frequency: null, clarity: 0 };
  }

  const autocorrelation = new Float32Array(trimmedSize);
  for (let lag = 0; lag < trimmedSize; lag++) {
    let correlation = 0;
    for (let i = 0; i < trimmedSize - lag; i++) {
      correlation += trimmed[i] * trimmed[i + lag];
    }
    autocorrelation[lag] = correlation;
  }

  let d = 0;
  while (d < trimmedSize - 1 && autocorrelation[d] > autocorrelation[d + 1]) {
    d++;
  }

  let maxPos = -1;
  let maxVal = -1;
  for (let i = d; i < trimmedSize; i++) {
    const value = autocorrelation[i];
    if (value > maxVal) {
      maxVal = value;
      maxPos = i;
    }
  }

  if (maxPos <= 0) {
    return { frequency: null, clarity: 0 };
  }

  let betterPeriod = maxPos;
  if (maxPos > 0 && maxPos < trimmedSize - 1) {
    const left = autocorrelation[maxPos - 1];
    const center = autocorrelation[maxPos];
    const right = autocorrelation[maxPos + 1];
    const divisor = 2 * center - left - right;
    if (divisor !== 0) {
      betterPeriod = maxPos + (right - left) / (2 * divisor);
    }
  }

  if (!betterPeriod || Number.isNaN(betterPeriod)) {
    return { frequency: null, clarity: 0 };
  }

  const frequency = sampleRate / betterPeriod;
  if (frequency < 30 || frequency > 2000) {
    return { frequency: null, clarity: 0 };
  }

  const reference = autocorrelation[0];
  const clarity = reference === 0 ? 0 : maxVal / reference;

  return { frequency, clarity };
}

export function frequencyToMidi(frequency) {
  if (!frequency || Number.isNaN(frequency)) {
    return null;
  }
  const midi = Math.round(12 * Math.log2(frequency / 440) + 69);
  if (midi < 0 || midi > 127) {
    return null;
  }
  return midi;
}

export function midiToNote(midi) {
  if (midi === null || midi === undefined) {
    return null;
  }
  const safeMidi = Math.min(Math.max(midi, 0), 127);
  const name = NOTE_NAMES[safeMidi % 12];
  const octave = Math.floor(safeMidi / 12) - 1;
  return { name, octave, midi: safeMidi };
}

export function formatNote({ name, octave }) {
  return `${name}${octave}`;
}

export function mergeNotes(notes, minDuration = 0.25) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return [];
  }

  const merged = [];
  for (const note of notes) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...note });
      continue;
    }

    if (note.midi === last.midi && note.timestamp - last.timestamp < minDuration) {
      last.duration = (last.duration || minDuration) + minDuration;
      continue;
    }

    merged.push({ ...note });
  }

  return merged;
}

export function calculateRms(buffer) {
  if (!buffer || buffer.length === 0) {
    return 0;
  }
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    const sample = buffer[i];
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / buffer.length);
}

export const NOTE_NAMES_LIST = NOTE_NAMES;
