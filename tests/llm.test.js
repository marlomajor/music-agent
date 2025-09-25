import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMelody } from '../src/lib/llm.js';

test('summarizeMelody defaults to C major when no notes detected', () => {
  const summary = summarizeMelody([]);
  assert.equal(summary.likely_key, 'C major');
  assert.ok(summary.suggested_chords.includes('C'));
});

test('summarizeMelody selects dominant pitch class', () => {
  const summary = summarizeMelody(['G4', 'B4', 'G4', 'D5']);
  assert.equal(summary.likely_key, 'G major');
  assert.ok(summary.suggested_chords.includes('D'));
});
