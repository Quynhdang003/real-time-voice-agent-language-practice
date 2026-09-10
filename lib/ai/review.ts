import "server-only";
import { Type } from "@google/genai";
import { gemini } from "./gemini";
import { parseSessionReview } from "@/lib/practice/session";
import type { SessionReview, TranscriptTurn } from "@/lib/practice/session";

const MODEL = "gemini-3.5-flash-lite";
const MAX_TRANSCRIPT_CHARS = 12_000;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER },
    metrics: {
      type: Type.OBJECT,
      properties: {
        fluency: { type: Type.NUMBER },
        grammar: { type: Type.NUMBER },
        vocabulary: { type: Type.NUMBER },
      },
      propertyOrdering: ["fluency", "grammar", "vocabulary"],
    },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    corrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          corrected: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        propertyOrdering: ["original", "corrected", "explanation"],
      },
    },
    vocabulary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { word: { type: Type.STRING }, definition: { type: Type.STRING } },
        propertyOrdering: ["word", "definition"],
      },
    },
    tutorFeedback: { type: Type.STRING },
  },
  propertyOrdering: ["overallScore", "metrics", "strengths", "corrections", "vocabulary", "tutorFeedback"],
};

function formatTranscript(turns: TranscriptTurn[]): string {
  const text = turns.map((turn) => `${turn.role === "tutor" ? "Tutor" : "Learner"}: ${turn.text}`).join("\n");
  return text.length > MAX_TRANSCRIPT_CHARS ? text.slice(0, MAX_TRANSCRIPT_CHARS) : text;
}

export type GenerateReviewResult =
  | { status: "ok"; review: SessionReview }
  | { status: "quota" | "invalid_output" | "unavailable" };

export async function generateSessionReview(
  transcript: TranscriptTurn[],
  context: { language: string; topic: string; level: string },
): Promise<GenerateReviewResult> {
  const prompt = [
    "You are an English language tutor reviewing a practice conversation transcript.",
    `Practice language: ${context.language}. Topic: ${context.topic}. Learner level: ${context.level}.`,
    "Assess only the learner's turns, not the tutor's. Score fluency, grammar and vocabulary from 0-100.",
    "List up to 5 genuine strengths, up to 8 sentence corrections (only for real learner errors, omit if none found), " +
      "up to 8 vocabulary suggestions relevant to the topic and level, and a short encouraging tutor feedback paragraph.",
    "Write the entire response in English.",
    "Transcript:",
    formatTranscript(transcript),
  ].join("\n");

  try {
    const response = await gemini.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
    });
    if (!response.text) return { status: "invalid_output" };
    let parsed: unknown;
    try { parsed = JSON.parse(response.text); } catch { return { status: "invalid_output" }; }
    const review = parseSessionReview(parsed);
    if (!review) return { status: "invalid_output" };
    return { status: "ok", review };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/quota|rate limit|429|RESOURCE_EXHAUSTED/i.test(message)) return { status: "quota" };
    return { status: "unavailable" };
  }
}