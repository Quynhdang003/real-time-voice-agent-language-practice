// Parses the plain-text transcript format served at Dograh's transcript_url:
// "[timestamp] role: text", with unlabeled continuation lines belonging to
// the previous turn. Verified against a real downloaded sample (31.txt).
import type { TranscriptTurn } from "@/lib/practice/session";

const TURN_START = /^\[([^\]]+)\]\s+(assistant|user):\s?(.*)$/;
const MAX_TURNS = 400;
const MAX_TURN_CHARS = 2000;
const MAX_TOTAL_CHARS = 20_000;

export function parseDograhTranscriptText(raw: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  let total = 0;
  for (const rawLine of raw.split(/\r?\n/)) {
    if (total >= MAX_TOTAL_CHARS || turns.length >= MAX_TURNS) break;
    const match = TURN_START.exec(rawLine);
    if (match) {
      const [, at, speaker, text] = match;
      const trimmed = text.trim();
      turns.push({
        role: speaker === "assistant" ? "tutor" : "learner",
        text: trimmed.slice(0, MAX_TURN_CHARS),
        at: at.trim().slice(0, 64),
      });
      total += trimmed.length;
      continue;
    }
    const line = rawLine.trim();
    if (!line || turns.length === 0) continue;
    const current = turns[turns.length - 1];
    current.text = (current.text ? `${current.text}\n${line}` : line).slice(0, MAX_TURN_CHARS);
    total += line.length;
  }
  return turns.filter((turn) => turn.text.length > 0);
}