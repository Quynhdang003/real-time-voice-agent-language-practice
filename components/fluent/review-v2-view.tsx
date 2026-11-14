import type { ReactNode } from "react";
import {
  AudioLines, Braces, CircleCheck, CircleMinus, CircleX, Flag, Lightbulb, ListChecks, MessagesSquare, SpellCheck, Target,
} from "lucide-react";
import { speakingSkillKeys } from "@/lib/practice/review-v2";
import type {
  Bilingual, SessionReviewV2, SpeakingSkillKey, VocabularyJudgment, VocabularyStatus, WeakPointStatus,
} from "@/lib/practice/review-v2";
import { skillLevelLabel } from "@/lib/practice/review-view";
import { cn } from "@/lib/utils";

// English first; the same content in Vietnamese below (RV-01 bilingual output).
export function BilingualText({ text, className }: { text: Bilingual; className?: string }) {
  return (
    <div className={cn("space-y-1 text-sm leading-6", className)}>
      <p className="text-app-text">{text.en}</p>
      <p lang="vi" className="text-app-muted">{text.vi}</p>
    </div>
  );
}

// The learner's own words, as spoken.
function LearnerQuote({ children }: { children: ReactNode }) {
  return <span className="text-sm italic leading-6 text-app-text">“{children}”</span>;
}

const badgeTones = {
  green: "bg-green-50 text-green-700 ring-green-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
} as const;
function Badge({ tone, icon, children }: { tone: keyof typeof badgeTones; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", badgeTones[tone])}>
      {icon}{children}
    </span>
  );
}

const vocabularyBadges: Record<VocabularyStatus, { label: string; tone: keyof typeof badgeTones; icon: ReactNode }> = {
  used_correctly: { label: "Used correctly", tone: "green", icon: <CircleCheck className="h-3.5 w-3.5" /> },
  used_incorrectly: { label: "Used incorrectly", tone: "red", icon: <CircleX className="h-3.5 w-3.5" /> },
  not_used: { label: "Not used", tone: "slate", icon: <CircleMinus className="h-3.5 w-3.5" /> },
};
const weakPointBadges: Record<WeakPointStatus, { label: string; tone: keyof typeof badgeTones }> = {
  improved: { label: "Improved", tone: "green" },
  still_present: { label: "Still present", tone: "amber" },
  not_observed: { label: "Not observed", tone: "slate" },
};
const skillMeta: Record<SpeakingSkillKey, { label: string; icon: typeof Braces }> = {
  grammarAccuracy: { label: "Grammar accuracy", icon: Braces },
  lexicalRange: { label: "Lexical range", icon: SpellCheck },
  fluencyCoherence: { label: "Fluency & coherence", icon: AudioLines },
  interaction: { label: "Interaction", icon: MessagesSquare },
};

function Card({ title, icon, children, className }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6", className)}>
      <div className="flex items-center gap-2 text-app-primary">{icon}<h3 className="text-lg font-bold text-app-text">{title}</h3></div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function VocabularyList({ items }: { items: VocabularyJudgment[] }) {
  return (
    <ul className="divide-y divide-app-border">
      {items.map((item) => {
        const badge = vocabularyBadges[item.status];
        return (
          <li key={item.word} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-app-text">{item.word}</span>
              <Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge>
            </div>
            {item.evidence ? <p className="mt-1"><LearnerQuote>{item.evidence}</LearnerQuote></p> : null}
            {item.correction ? <BilingualText text={item.correction} className="mt-2 [&>p:first-child]:font-semibold [&>p:first-child]:text-emerald-700" /> : null}
            {item.explanation ? <BilingualText text={item.explanation} className="mt-1" /> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function ReviewV2View({ review, level }: { review: SessionReviewV2; level: string }) {
  const { sessionGoals: goals } = review;
  const scenario = goals.scenarioCompleted;
  return (
    <>
      <section className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-white to-indigo-50 p-6 shadow-highlight sm:p-8" aria-labelledby="overall-feedback">
        <p id="overall-feedback" className="text-sm font-bold uppercase tracking-[0.1em] text-app-primary">Overall feedback</p>
        <BilingualText text={review.overallFeedback} className="mt-3 max-w-3xl text-base leading-7 [&>p]:text-base [&>p]:leading-7" />
        <div className="mt-5 rounded-xl border border-app-border bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Flag className="h-4 w-4 text-app-primary" />
            <span className="text-sm font-semibold text-app-text">Scenario</span>
            {scenario.completed
              ? <Badge tone="green" icon={<CircleCheck className="h-3.5 w-3.5" />}>Scenario completed</Badge>
              : <Badge tone="amber">Scenario not completed</Badge>}
          </div>
          <BilingualText text={scenario.comment} className="mt-2" />
          {scenario.evidence ? <p className="mt-1"><LearnerQuote>{scenario.evidence}</LearnerQuote></p> : null}
        </div>
      </section>

      <section className="mb-8" aria-labelledby="session-goals">
        <h2 id="session-goals" className="text-2xl font-bold tracking-tight text-app-text">Session goals</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card title="Target vocabulary" icon={<Target className="h-5 w-5" />}>
            {goals.targetVocabulary.length > 0
              ? <VocabularyList items={goals.targetVocabulary} />
              : <p className="text-sm text-app-muted">This session had no target vocabulary.</p>}
          </Card>
          <div className="space-y-5">
            {goals.reviewVocabulary.length > 0 ? (
              <Card title="Review vocabulary" icon={<ListChecks className="h-5 w-5" />}><VocabularyList items={goals.reviewVocabulary} /></Card>
            ) : null}
            {goals.grammarFocus ? (
              <Card title="Grammar focus" icon={<Braces className="h-5 w-5" />}>
                <p className="text-sm text-app-muted">
                  <span className="font-semibold text-green-700">{goals.grammarFocus.correctCount} correct</span>
                  {" · "}
                  <span className="font-semibold text-red-700">{goals.grammarFocus.incorrectCount} incorrect</span>
                </p>
                <ul className="mt-3 space-y-3">
                  {goals.grammarFocus.examples.map((example, index) => (
                    <li key={index} className="rounded-xl border border-app-border p-3">
                      <LearnerQuote>{example.original}</LearnerQuote>
                      {example.corrected ? <BilingualText text={example.corrected} className="mt-1 [&>p:first-child]:font-semibold [&>p:first-child]:text-emerald-700" /> : null}
                      {example.explanation ? <BilingualText text={example.explanation} className="mt-1" /> : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            <Card title="Weak points" icon={<Lightbulb className="h-5 w-5" />}>
              {goals.weakPoints.length > 0 ? (
                <ul className="divide-y divide-app-border">
                  {goals.weakPoints.map((point) => (
                    <li key={point.point} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-app-text">{point.point}</span>
                        <Badge tone={weakPointBadges[point.status].tone}>{weakPointBadges[point.status].label}</Badge>
                      </div>
                      {point.evidence ? <p className="mt-1"><LearnerQuote>{point.evidence}</LearnerQuote></p> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-app-muted">This session had no weak points to practise.</p>}
            </Card>
          </div>
        </div>
      </section>

      <section className="mb-8" aria-labelledby="speaking-skills">
        <h2 id="speaking-skills" className="text-2xl font-bold tracking-tight text-app-text">Speaking skills</h2>
        <p className="mb-5 mt-1 text-sm text-app-muted">Scored 1–5 against this session&apos;s level, {level}.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {speakingSkillKeys.map((key) => {
            const skill = review.speakingSkills[key];
            const { label, icon: Icon } = skillMeta[key];
            return (
              <article key={key} className="rounded-2xl border border-app-border bg-white p-5 shadow-card">
                <Icon className="h-6 w-6 text-app-primary" />
                <h3 className="mt-4 font-bold text-app-text">{label}</h3>
                <p className="mt-3 text-2xl font-bold text-app-primary" aria-label={`Score ${skill.score} out of 5`}>
                  {skill.score}<span className="text-base font-semibold text-app-muted"> / 5</span>
                </p>
                <p className="text-sm font-semibold text-app-muted">{skillLevelLabel(skill.score, level)}</p>
                <BilingualText text={skill.comment} className="mt-3" />
                <ul className="mt-3 space-y-1">
                  {skill.evidence.map((quote, index) => <li key={index}><LearnerQuote>{quote}</LearnerQuote></li>)}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <Card title="Grammar errors" icon={<SpellCheck className="h-5 w-5" />}>
          {review.grammarErrors.length > 0 ? (
            <ul className="space-y-4">
              {review.grammarErrors.map((error, index) => (
                <li key={index} className="rounded-xl border border-app-border p-3">
                  <p className="text-sm text-red-600 line-through">{error.original}</p>
                  <BilingualText text={error.corrected} className="mt-1 [&>p:first-child]:font-semibold [&>p:first-child]:text-emerald-700" />
                  <BilingualText text={error.explanation} className="mt-1" />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-app-muted">No grammar errors found — nice work!</p>}
        </Card>
        <Card title="Next time" icon={<Lightbulb className="h-5 w-5" />}>
          {review.nextWeakPoints.length > 0 ? (
            <>
              <p className="text-sm text-app-muted">Suggested weak points for your next session.</p>
              <ul className="mt-3 space-y-3">
                {review.nextWeakPoints.map((point, index) => <li key={index}><BilingualText text={point} /></li>)}
              </ul>
            </>
          ) : <p className="text-sm text-app-muted">No new weak points from this session.</p>}
        </Card>
      </div>
    </>
  );
}
