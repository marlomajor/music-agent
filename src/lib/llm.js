const KEY_MAP = {
  C: { key: "C major", chords: ["C", "F", "G", "Am"], style: "folk / pop" },
  G: { key: "G major", chords: ["G", "C", "D", "Em"], style: "bluegrass" },
  D: { key: "D major", chords: ["D", "G", "A", "Bm"], style: "rock" },
  A: { key: "A major", chords: ["A", "D", "E", "F#m"], style: "country" },
  E: { key: "E minor", chords: ["Em", "C", "D", "G"], style: "indie" },
  F: { key: "F major", chords: ["F", "Bb", "C", "Dm"], style: "ballad" }
};

export function summarizeMelody(noteSequence) {
  if (!Array.isArray(noteSequence) || noteSequence.length === 0) {
    return {
      likely_key: "C major",
      style: "ambient",
      suggested_chords: ["C", "F", "G"],
      explanation: "No melody detected yet. Try recording a short idea to get theory suggestions."
    };
  }

  const counts = new Map();
		
  for (const note of noteSequence) {
    const pitchClass = note.replace(/\d+/g, "");
    counts.set(pitchClass, (counts.get(pitchClass) || 0) + 1);
  }

  let dominantPitch = "C";
  let maxCount = 0;
  for (const [pitch, count] of counts.entries()) {
    if (count > maxCount) {
      dominantPitch = pitch;
      maxCount = count;
    }
  }

  const match = KEY_MAP[dominantPitch] || KEY_MAP.C;

  return {
    likely_key: match.key,
    style: match.style,
    suggested_chords: match.chords,
    explanation: `Your melody leans on ${dominantPitch}, which maps naturally to ${match.key}. Try the ${match.chords.join(", ")}`
  };
}

export { KEY_MAP };
