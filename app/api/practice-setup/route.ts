import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";

export const runtime = "nodejs";

const languages = {
  english: "English",
  japanese: "Japanese",
  korean: "Korean",
  chinese: "Chinese",
  french: "French",
  spanish: "Spanish",
} as const;

const topics = {
  daily: "Daily Conversation",
  travel: "Travel",
  restaurant: "Restaurant",
  interview: "Job Interview",
  shopping: "Shopping",
  "free-talk": "Free Talk",
} as const;

const tutors = {
  emma: {
    name: "Emma",
    role: "English Tutor",
  },
} as const;

const levels = ["Beginner", "A1", "A2", "B1", "B2"] as const;
const durations = [5, 10, 15] as const;

type PracticeSetupInput = {
  languageId: keyof typeof languages;
  topicId: keyof typeof topics;
  level: (typeof levels)[number];
  durationMinutes: (typeof durations)[number];
  tutorId: keyof typeof tutors;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { success: false, message: "You must be signed in to start a practice session." },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The practice setup request is not valid JSON." },
      { status: 400 },
    );
  }

  const setup = parsePracticeSetup(body);

  if (!setup) {
    return NextResponse.json(
      { success: false, message: "Please select a valid language, topic, level, duration, and tutor." },
      { status: 400 },
    );
  }

  const tutor = tutors[setup.tutorId];
  const sessionDocument = adminDb.collection("practiceSessions").doc();

  try {
    await sessionDocument.set({
      userId: user.id,
      language: {
        id: setup.languageId,
        name: languages[setup.languageId],
      },
      topic: {
        id: setup.topicId,
        name: topics[setup.topicId],
      },
      level: setup.level,
      durationMinutes: setup.durationMinutes,
      tutor: {
        id: setup.tutorId,
        name: tutor.name,
        role: tutor.role,
      },
      status: "ready",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      {
        success: true,
        sessionId: sessionDocument.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[practiceSetup.POST]", {
      code: getErrorCode(error) ?? "unknown",
      message: error instanceof Error ? error.message : "Unknown Firestore error",
      userId: user.id,
    });

    return NextResponse.json(
      { success: false, message: "We could not create your practice session. Please try again." },
      { status: 500 },
    );
  }
}

function parsePracticeSetup(value: unknown): PracticeSetupInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const { languageId, topicId, level, durationMinutes, tutorId } = value;

  if (
    !isKeyOf(languageId, languages) ||
    !isKeyOf(topicId, topics) ||
    !isOneOf(level, levels) ||
    !isOneOf(durationMinutes, durations) ||
    !isKeyOf(tutorId, tutors)
  ) {
    return null;
  }

  return {
    languageId,
    topicId,
    level,
    durationMinutes,
    tutorId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKeyOf<T extends object>(value: unknown, target: T): value is keyof T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(target, value);
}

function isOneOf<const T extends readonly unknown[]>(
  value: unknown,
  options: T,
): value is T[number] {
  return options.some((option) => option === value);
}

function getErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}
