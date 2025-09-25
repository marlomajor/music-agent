import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, frequencyToMidi, midiToNote, formatNote, mergeNotes, calculateRms } from '../src/lib/pitch.js';

test('detectPitch identifies a 440Hz sine wave', () => {
  const sampleRate = 44100;
  const frequency = 440;
  const buffer = new Float32Array(2048);
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }

  const { frequency: detected, clarity } = detectPitch(buffer, sampleRate);
  assert.ok(detected, 'frequency should be detected');
  assert.ok(Math.abs(detected - frequency) < 2, `expected ~${frequency}Hz but got ${detected}`);
  assert.ok(clarity > 0.5, 'clarity should be reasonable');
});

test('frequencyToMidi clamps to valid MIDI range', () => {
  assert.equal(frequencyToMidi(440), 69);
  assert.equal(frequencyToMidi(261.63), 60);
  assert.equal(frequencyToMidi(0), null);
  assert.equal(frequencyToMidi(40000), null);
});

test('midiToNote renders pitch names', () => {
  const note = midiToNote(69);
  assert.equal(note.name, 'A');
  assert.equal(note.octave, 4);
  assert.equal(formatNote(note), 'A4');
});

test('mergeNotes collapses repeated pitches within threshold', () => {
  const notes = [
    { midi: 60, timestamp: 0 },
    { midi: 60, timestamp: 0.1 },
    { midi: 62, timestamp: 0.4 }
  ];

  const merged = mergeNotes(notes, 0.3);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].midi, 60);
  assert.equal(merged[1].midi, 62);
});

test('calculateRms returns 0 for silence', () => {
  const silent = new Float32Array(512);
  assert.equal(calculateRms(silent), 0);
});
