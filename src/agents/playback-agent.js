export function createPlaybackAgent(tone) {
  async function play(notes) {
    if (!tone || !Array.isArray(notes) || notes.length === 0) {
      return;
    }
    await tone.start();
    const synth = new tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, release: 0.4 }
    }).toDestination();
    const now = tone.now();
    const step = 0.5;
    notes.forEach((note, index) => {
      const toneNote = tone.Frequency(note.midi, "midi").toNote();
      synth.triggerAttackRelease(toneNote, "8n", now + index * step);
    });
  }
  return { play };
}
