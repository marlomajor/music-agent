import { summarizeMelody } from "../lib/llm.js";
import { formatNote } from "../lib/pitch.js";

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
        { role: "system", content: "You are a helpful music theory assistant. Always respond with valid JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
}

export function createInsightAgent({ ui }) {
  async function analyze(notes, apiKey) {
    if (!Array.isArray(notes) || notes.length === 0) {
      ui.showLiveFeedback("");
      return summarizeMelody([]);
    }
    const noteSequence = notes.map((note) => formatNote(note));
    ui.showLiveFeedback("Contacting the language model...");
    let payload;
    if (!apiKey) {
      payload = summarizeMelody(noteSequence);
    } else {
      try {
        payload = await callOpenAI(apiKey, noteSequence);
      } catch (error) {
        console.error("LLM error", error);
        payload = summarizeMelody(noteSequence);
        ui.setStatus("LLM call failed, falling back to heuristic.", "warning");
      }
    }
    if (payload?.explanation) {
      ui.showLiveFeedback(payload.explanation);
    } else {
      ui.showLiveFeedback("");
    }
    return payload;
  }
  return { analyze };
}
