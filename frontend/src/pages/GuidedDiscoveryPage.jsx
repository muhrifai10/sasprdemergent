import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Check, CircleHelp, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import AppLayout from "../components/AppLayout";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import {
  api,
  getDiscovery,
  getDiscoveryReview,
  getRecommendations,
  guidedAnalyze,
  normalizeApiError,
  submitGuidedDecisions,
} from "../lib/api";
import { useLang } from "../context/LanguageContext";

const t = {
  id: {
    eyebrow: "GUIDED DISCOVERY",
    title: "Mari pertegas ide project",
    sub: "AI membantu menemukan pertanyaan penting. Anda tetap memegang setiap keputusan.",
    analyze: "Mulai analisis",
    analyzing: "Menganalisis...",
    reload: "Coba lagi",
    loading: "Memuat discovery...",
    ready: "Project siap dianalisis.",
    noQuestions: "Belum ada pertanyaan aktif.",
    confirmed: "Discovery sudah dikonfirmasi. Tampilan ini read-only.",
    recommended: "Direkomendasikan",
    required: "Wajib",
    input: "Input",
    answerOwn: "Jawab sendiri",
    unknown: "Belum tahu",
    notRequired: "Tidak diperlukan",
    unknownState: "Belum ditentukan",
    notRequiredState: "Tidak diperlukan",
    confirmedState: "Confirmed",
    status: "Status",
    round: "Round",
    questions: "Pertanyaan",
    answered: "Terjawab",
    readiness: "Readiness",
    gaps: "Blocking gaps",
    draft: "Sedang dipilih",
    useCustom: "Gunakan jawaban ini",
    customPlaceholder: "Tulis jawaban Anda...",
    edit: "Edit jawaban",
    cancel: "Batal",
    continue: "Lanjutkan",
    unanswered: "pertanyaan belum dijawab",
    pending: "pilihan siap dikirim",
    noDraft: "Pilih atau isi setidaknya satu jawaban sebelum melanjutkan.",
    invalid: "Periksa jawaban yang belum valid.",
    refreshed: "Pertanyaan terbaru sudah dimuat.",
    review: "Review Produk",
    reviewSub: "Ringkasan ini selalu mengikuti response backend terbaru.",
    reviewAgain: "Periksa lagi",
    readyForConfirmation: "Siap untuk konfirmasi",
    confirmationNext: "Konfirmasi tersedia pada tahap berikutnya.",
    unknownSection: "Belum ditentukan",
    notRequiredSection: "Tidak diperlukan",
    summary: "Ringkasan produk",
    requiredGaps: "Informasi wajib",
    conditionalGaps: "Informasi kondisional",
    unknownBlocking: "Unknown yang menghalangi",
    blockingMessage: "Masih ada informasi yang perlu dilengkapi",
    readyMessage: "Siap ditinjau",
    noItems: "Tidak ada item.",
    sourceRecommendation: "Rekomendasi dipilih",
    sourceCustom: "Jawaban sendiri",
    sourceUser: "Jawaban Anda",
    sourceOther: "Jawaban tersimpan",
    inferred: "Inferred",
    product: "Produk",
    purpose: "Tujuan",
    users: "Pengguna",
    features: "Fitur",
    workflow: "Workflow",
    roles: "Roles",
    payment: "Pembayaran",
    inventory: "Inventory",
    authentication: "Authentication",
    technology: "Technology",
    database: "Database",
    infrastructure: "Infrastructure",
    storage: "Storage",
    paymentProvider: "Payment provider",
    history: "Decision history",
  },
  en: {
    eyebrow: "GUIDED DISCOVERY",
    title: "Clarify your project idea",
    sub: "AI helps find important questions. You keep every decision.",
    analyze: "Start analysis",
    analyzing: "Analyzing...",
    reload: "Try again",
    loading: "Loading discovery...",
    ready: "Project is ready to analyze.",
    noQuestions: "No active questions.",
    confirmed: "Discovery is confirmed. This view is read-only.",
    recommended: "Recommended",
    required: "Required",
    input: "Input",
    answerOwn: "Answer yourself",
    unknown: "I don't know",
    notRequired: "Not required",
    unknownState: "Not determined",
    notRequiredState: "Not required",
    confirmedState: "Confirmed",
    status: "Status",
    round: "Round",
    questions: "Questions",
    answered: "Answered",
    readiness: "Readiness",
    gaps: "Blocking gaps",
    draft: "Selected for submission",
    useCustom: "Use this answer",
    customPlaceholder: "Write your answer...",
    edit: "Edit answer",
    cancel: "Cancel",
    continue: "Continue",
    unanswered: "questions unanswered",
    pending: "selections ready to send",
    noDraft: "Choose or enter at least one answer before continuing.",
    invalid: "Check the answers that are not valid yet.",
    refreshed: "The latest questions were loaded.",
    review: "Product Review",
    reviewSub: "This summary always follows the latest backend response.",
    reviewAgain: "Check again",
    readyForConfirmation: "Ready for confirmation",
    confirmationNext: "Confirmation is available in the next stage.",
    unknownSection: "Not determined",
    notRequiredSection: "Not required",
    summary: "Product summary",
    requiredGaps: "Required information",
    conditionalGaps: "Conditional information",
    unknownBlocking: "Blocking unknowns",
    blockingMessage: "More information is needed",
    readyMessage: "Ready for review",
    noItems: "No items.",
    sourceRecommendation: "Recommendation selected",
    sourceCustom: "Custom answer",
    sourceUser: "Your answer",
    sourceOther: "Saved answer",
    inferred: "Inferred",
    product: "Product",
    purpose: "Purpose",
    users: "Users",
    features: "Features",
    workflow: "Workflow",
    roles: "Roles",
    payment: "Payment",
    inventory: "Inventory",
    authentication: "Authentication",
    technology: "Technology",
    database: "Database",
    infrastructure: "Infrastructure",
    storage: "Storage",
    paymentProvider: "Payment provider",
    history: "Decision history",
  },
};

const RESERVED_OPTIONS = new Set(["unknown", "not required", "other"]);

export function buildDecisionIntent(questionId, type, value) {
  if (type === "recommendation") return { question_id: questionId, type, recommendation_id: value };
  if (type === "custom") return { question_id: questionId, type, value };
  return { question_id: questionId, type };
}

export function validateQuestionDraft(question, draft) {
  if (!draft) return null;
  if (["unknown", "not_required"].includes(draft.type)) {
    const allowed = draft.type === "unknown" ? question.allow_unknown : question.allow_not_required;
    return allowed ? null : "Pilihan ini tidak tersedia untuk pertanyaan ini.";
  }
  if (draft.type === "recommendation") {
    return question.recommendations?.some((item) => item.id === draft.recommendation_id)
      ? null
      : "Rekomendasi ini sudah tidak tersedia.";
  }
  if (draft.type !== "custom") return "Jenis jawaban tidak dikenali.";
  const value = String(draft.value || "").trim();
  if (!value) return "Jawaban tidak boleh kosong.";
  if (value.length > 2000) return "Jawaban terlalu panjang.";
  if (question.type === "number" && !/^-?(?:\d+|\d*\.\d+)$/.test(value)) return "Masukkan angka yang valid.";
  if (question.type === "boolean" && !["yes", "no", "ya", "tidak", "true", "false", "y", "n"].includes(value.toLowerCase())) return "Pilih Yes atau No.";
  return null;
}

export function sanitizeDraftDecision(question, draft) {
  if (!draft || validateQuestionDraft(question, draft)) return null;
  return buildDecisionIntent(question.question_id || question.id, draft.type, draft.type === "recommendation" ? draft.recommendation_id : draft.value);
}

function questionIdOf(question) {
  return question.question_id || question.id;
}

function mergeQuestionRecommendations(question, result) {
  return {
    ...question,
    question_id: questionIdOf(question),
    recommendations: question.recommendations || result?.recommendations || [],
  };
}

function multiValues(draft) {
  return draft?.type === "custom" ? String(draft.value || "").split(" + ").map((value) => value.trim()).filter(Boolean) : [];
}

function optionKey(value) {
  return String(value).toLowerCase();
}

export function QuestionCard({ question, copy, draft, serverDecision, submitting, editing, validationError, onDraft, onEdit, onCancelEdit }) {
  const questionId = questionIdOf(question);
  const resolvedDecision = serverDecision || (question.status ? { status: question.status, value: question.value || "" } : null);
  const isResolved = Boolean(resolvedDecision) && !editing;
  const options = question.options?.length ? question.options : question.type === "boolean" ? ["Yes", "No"] : [];
  const recommendations = question.recommendations || [];
  const values = multiValues(draft);
  const selectOption = (option) => {
    const normalized = optionKey(option);
    if (question.type === "multi_choice") {
      const next = values.includes(option) ? values.filter((value) => value !== option) : [...values, option];
      onDraft(buildDecisionIntent(questionId, "custom", next.join(" + ")));
      return;
    }
    const recommendation = recommendations.find((item) => item.value === option);
    if (recommendation) onDraft(buildDecisionIntent(questionId, "recommendation", recommendation.id));
    else if (normalized === "unknown" && question.allow_unknown) onDraft(buildDecisionIntent(questionId, "unknown"));
    else if (normalized === "not required" && question.allow_not_required) onDraft(buildDecisionIntent(questionId, "not_required"));
    else if (!RESERVED_OPTIONS.has(normalized) && (question.allow_custom || question.type === "boolean")) onDraft(buildDecisionIntent(questionId, "custom", option));
  };
  const selectRecommendation = (recommendation) => {
    if (question.type === "multi_choice") {
      const next = values.includes(recommendation.value)
        ? values.filter((value) => value !== recommendation.value)
        : [...values, recommendation.value];
      onDraft(buildDecisionIntent(questionId, "custom", next.join(" + ")));
    } else {
      onDraft(buildDecisionIntent(questionId, "recommendation", recommendation.id));
    }
  };
  const selectedRecommendation = draft?.type === "recommendation" ? draft.recommendation_id : null;
  const customValue = draft?.type === "custom" ? draft.value : "";

  return (
    <Card className="border-white/10 bg-[#121212] shadow-none" data-testid={`guided-question-card-${questionId}`}>
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full border-indigo-500/30 text-[10px] uppercase tracking-widest text-indigo-300">{question.category}</Badge>
          <Badge variant="secondary" className="rounded-full text-[10px]">{question.type}</Badge>
          {question.required && <Badge variant="outline" className="rounded-full border-amber-500/30 text-[10px] text-amber-300">{copy.required}</Badge>}
          {resolvedDecision?.status && isResolved && <Badge variant="secondary" className="rounded-full text-[10px]">{resolvedDecision.status}</Badge>}
        </div>
        <CardTitle className="text-lg leading-relaxed text-white" id={`guided-question-${questionId}`}>{question.question}</CardTitle>
        <CardDescription className="font-mono text-[10px] text-zinc-600">{copy.input}: {question.type} · {questionId}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isResolved ? (
          <div className="flex flex-col gap-3 border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid={`guided-decision-${questionId}`}>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><Check size={15} aria-hidden="true" />{resolvedDecision.status === "CONFIRMED" ? copy.confirmedState : resolvedDecision.status === "UNKNOWN" ? copy.unknownState : copy.notRequiredState}</p>
              {resolvedDecision.value && <p className="mt-1 text-sm text-zinc-300">{resolvedDecision.value}</p>}
            </div>
            {onEdit && <button type="button" onClick={() => onEdit(questionId)} disabled={submitting} className="min-h-11 border border-white/15 px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-indigo-400/50 hover:text-white disabled:opacity-50" data-testid={`guided-edit-${questionId}`}>{copy.edit}</button>}
          </div>
        ) : (
          <>
            {options.length > 0 && (
              <div className="space-y-2" role={question.type === "multi_choice" ? "group" : "radiogroup"} aria-labelledby={`guided-question-${questionId}`}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{copy.input}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.map((option) => {
                    const selected = question.type === "multi_choice" ? values.includes(option) : (draft?.type === "custom" && draft.value === option) || recommendations.some((item) => item.id === selectedRecommendation && item.value === option);
                    const reserved = RESERVED_OPTIONS.has(optionKey(option));
                    const enabled = !submitting && (!reserved || (optionKey(option) === "unknown" ? question.allow_unknown : optionKey(option) === "not required" ? question.allow_not_required : question.allow_custom || question.type === "boolean"));
                    return <button key={option} type="button" role={question.type === "multi_choice" ? "checkbox" : "radio"} aria-checked={selected} aria-pressed={selected} disabled={!enabled} onClick={() => selectOption(option)} className={`flex min-h-11 items-center gap-3 border px-3 py-2.5 text-left text-sm transition-colors ${selected ? "border-indigo-400/60 bg-indigo-500/15 text-white" : "border-white/10 text-zinc-300 hover:border-white/25"} disabled:cursor-not-allowed disabled:opacity-50`} data-testid={`guided-option-${questionId}-${option}`}><span className={`h-3.5 w-3.5 shrink-0 border ${question.type === "multi_choice" ? "rounded-sm" : "rounded-full"} ${selected ? "border-indigo-300 bg-indigo-400" : "border-zinc-600"}`} aria-hidden="true" />{option}</button>;
                  })}
                </div>
              </div>
            )}
            {recommendations.length > 0 && (
              <div className="space-y-2" data-testid={`guided-recommendations-${questionId}`}>
                <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-indigo-300"><Sparkles size={12} aria-hidden="true" />{copy.recommended}</p>
                <div className="grid gap-2 lg:grid-cols-2">
                  {recommendations.map((recommendation) => {
                    const selected = question.type === "multi_choice" ? values.includes(recommendation.value) : selectedRecommendation === recommendation.id;
                    return <button key={recommendation.id} type="button" role={question.type === "multi_choice" ? "checkbox" : "radio"} aria-checked={selected} aria-pressed={selected} disabled={submitting} onClick={() => selectRecommendation(recommendation)} className={`border p-3 text-left transition-colors disabled:opacity-50 ${selected ? "border-indigo-400/70 bg-indigo-500/15" : "border-indigo-500/20 bg-indigo-500/5 hover:border-indigo-400/50"}`} data-testid={`guided-recommendation-${recommendation.id}`}><span className="flex items-start justify-between gap-3"><span className="font-semibold text-sm text-white">{recommendation.label}</span>{selected && <Check size={15} className="shrink-0 text-indigo-200" aria-hidden="true" />}</span>{recommendation.reason && <span className="mt-1 block text-xs leading-relaxed text-zinc-400">{recommendation.reason}</span>}{(recommendation.tradeoffs || []).length > 0 && <span className="mt-2 block text-[11px] leading-relaxed text-zinc-500">Tradeoff: {recommendation.tradeoffs.join(" ")}</span>}</button>;
                  })}
                </div>
              </div>
            )}
            {question.allow_custom && (
              <div className="space-y-2" data-testid={`guided-custom-${questionId}`}>
                <label htmlFor={`guided-custom-input-${questionId}`} className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{copy.answerOwn}</label>
                {question.type === "textarea" || question.type === "text" ? <textarea id={`guided-custom-input-${questionId}`} value={customValue} onChange={(event) => onDraft(buildDecisionIntent(questionId, "custom", event.target.value))} disabled={submitting} placeholder={copy.customPlaceholder} rows={3} className="w-full resize-y border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-400/60 disabled:opacity-50" data-testid={`guided-custom-input-${questionId}`} /> : <input id={`guided-custom-input-${questionId}`} value={customValue} onChange={(event) => onDraft(buildDecisionIntent(questionId, "custom", event.target.value))} disabled={submitting} placeholder={copy.customPlaceholder} className="min-h-11 w-full border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-zinc-600 focus:border-indigo-400/60 disabled:opacity-50" data-testid={`guided-custom-input-${questionId}`} />}
                <button type="button" onClick={() => onDraft(buildDecisionIntent(questionId, "custom", customValue))} disabled={submitting || !String(customValue || "").trim()} className="min-h-11 border border-indigo-500/40 px-4 text-xs font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-40" data-testid={`guided-custom-submit-${questionId}`}>{copy.useCustom}</button>
              </div>
            )}
            {question.allow_unknown && <button type="button" onClick={() => onDraft(buildDecisionIntent(questionId, "unknown"))} disabled={submitting} className={`min-h-11 border px-4 text-left text-sm transition-colors disabled:opacity-50 ${draft?.type === "unknown" ? "border-amber-400/60 bg-amber-500/10 text-amber-100" : "border-white/10 text-zinc-400 hover:border-amber-400/40 hover:text-white"}`} aria-pressed={draft?.type === "unknown"} data-testid={`guided-unknown-${questionId}`}><CircleHelp size={14} className="mr-2 inline" aria-hidden="true" />{copy.unknown}</button>}
            {question.allow_not_required && <button type="button" onClick={() => onDraft(buildDecisionIntent(questionId, "not_required"))} disabled={submitting} className={`min-h-11 border px-4 text-left text-sm transition-colors disabled:opacity-50 ${draft?.type === "not_required" ? "border-amber-400/60 bg-amber-500/10 text-amber-100" : "border-white/10 text-zinc-400 hover:border-amber-400/40 hover:text-white"}`} aria-pressed={draft?.type === "not_required"} data-testid={`guided-not-required-${questionId}`}>{copy.notRequired}</button>}
            {draft && <p className="flex items-center gap-2 text-xs text-indigo-200" aria-live="polite" data-testid={`guided-draft-${questionId}`}><Sparkles size={13} aria-hidden="true" />{copy.draft}</p>}
            {validationError && <p className="text-xs text-red-300" role="alert" data-testid={`guided-validation-${questionId}`}>{validationError}</p>}
            {editing && <button type="button" onClick={() => onCancelEdit(questionId)} disabled={submitting} className="min-h-11 text-xs text-zinc-500 hover:text-white disabled:opacity-50" data-testid={`guided-cancel-edit-${questionId}`}><X size={13} className="mr-1 inline" aria-hidden="true" />{copy.cancel}</button>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const REVIEW_SUMMARY_GROUPS = [
  { label: "Core", keys: ["product", "purpose", "target_users", "core_features", "workflows", "roles", "payment", "inventory", "authentication"] },
  { label: "Technical", keys: ["technology", "database", "infrastructure", "storage", "payment_provider"] },
];

function sourceLabel(source, copy) {
  if (source === "USER_RECOMMENDATION_SELECTION") return copy.sourceRecommendation;
  if (source === "USER_CUSTOM") return copy.sourceCustom;
  if (source?.startsWith("USER_")) return copy.sourceUser;
  return copy.sourceOther;
}

function summaryValue(item, copy) {
  if (!item || item.status === "UNKNOWN") return copy.unknownState;
  if (item.status === "NOT_REQUIRED") return copy.notRequiredState;
  return item.value || copy.unknownState;
}

function reviewDecisionLabel(decision, questionCatalog, copy) {
  const question = questionCatalog.find((item) => questionIdOf(item) === decision.question_id);
  return { category: question?.category || decision.question_id, question: question?.question || decision.question_id, source: sourceLabel(decision.source, copy) };
}

function ReviewDecisionList({ decisions, questionCatalog, copy, onEdit, canEdit, emptyText }) {
  if (!decisions.length) return <p className="text-sm text-zinc-500">{emptyText}</p>;
  return <div className="space-y-2">{decisions.map((decision) => { const label = reviewDecisionLabel(decision, questionCatalog, copy); return <div key={`${decision.question_id}-${decision.status}`} className="border border-white/10 bg-black/10 p-4" data-testid={`review-decision-${decision.question_id}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-mono uppercase tracking-widest text-indigo-300">{label.category}</p><p className="mt-1 text-sm font-semibold text-white">{label.question}</p><p className="mt-2 text-sm text-zinc-300">{decision.status === "CONFIRMED" ? decision.value || copy.confirmedState : decision.status === "UNKNOWN" ? copy.unknownState : copy.notRequiredState}</p>{decision.status === "CONFIRMED" && <p className="mt-2 text-xs text-zinc-500">{label.source}</p>}</div>{canEdit && <button type="button" onClick={() => onEdit(decision.question_id)} className="min-h-11 shrink-0 border border-white/15 px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-indigo-400/50 hover:text-white" data-testid={`review-edit-${decision.question_id}`}>{copy.edit}</button>}</div></div>; })}</div>;
}

export function ReviewPanel({ review, reviewLoading, reviewError, questionCatalog, copy, onRefresh, onEdit }) {
  if (reviewLoading && !review) return <section className="mt-10 space-y-4" data-testid="review-loading-state" aria-live="polite"><Skeleton className="h-10 w-48 bg-white/10" /><Skeleton className="h-56 w-full bg-white/10" /></section>;
  if (reviewError && !review) return <section className="mt-10 border border-red-500/30 bg-red-500/5 p-5" data-testid="review-error-state" role="alert" aria-live="assertive"><p className="text-sm text-red-200">{reviewError}</p><button type="button" onClick={onRefresh} className="btn-primary mt-4 min-h-11 px-4 text-sm font-semibold" data-testid="review-retry-btn"><RefreshCw size={14} className="mr-2 inline" />{copy.reviewAgain}</button></section>;
  if (!review) return null;

  const data = review.review || {};
  const completeness = review.completeness || {};
  const decisions = data.user_decisions || [];
  const confirmed = decisions.filter((decision) => decision.status === "CONFIRMED");
  const unknown = decisions.filter((decision) => decision.status === "UNKNOWN");
  const notRequired = decisions.filter((decision) => decision.status === "NOT_REQUIRED");
  const blockingGaps = review.blocking_gaps || completeness.blocking_gaps || [];
  const requiredGaps = completeness.required_missing || completeness.missing_required || [];
  const conditionalGaps = completeness.conditional_missing || [];
  const unknownBlocking = completeness.unknown || [];
  const summary = data.summary || {};

  return <section className="mt-10 space-y-5" data-testid="review-panel" aria-live="polite">
    <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-indigo-300">{copy.review}</p><h2 className="mt-2 text-2xl font-black tracking-tight text-white">{copy.summary}</h2><p className="mt-1 text-sm text-zinc-500">{copy.reviewSub}</p></div><button type="button" onClick={onRefresh} disabled={reviewLoading} className="min-h-11 border border-white/15 px-4 text-xs font-semibold text-zinc-300 transition-colors hover:border-indigo-400/50 hover:text-white disabled:opacity-50" data-testid="review-refresh-btn" aria-busy={reviewLoading}><RefreshCw size={14} className={`mr-2 inline ${reviewLoading ? "animate-spin" : ""}`} />{copy.reviewAgain}</button></div>
    {reviewError && <div className="border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200" data-testid="review-inline-error" role="alert">{reviewError}</div>}
    <div className={`border p-5 ${review.readiness === "ready_for_review" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/25 bg-amber-500/5"}`} data-testid="review-readiness"><p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{copy.readiness}</p><p className="mt-2 text-lg font-bold text-white">{review.readiness === "ready_for_review" ? copy.readyMessage : copy.blockingMessage}</p><p className="mt-1 text-xs text-zinc-400">{review.readiness}</p></div>
    <div className="grid gap-4 lg:grid-cols-2" data-testid="review-completeness"><div className="border border-white/10 bg-[#121212] p-5"><h3 className="text-sm font-semibold text-white">{copy.requiredGaps}</h3><GapList values={requiredGaps} copy={copy} testId="review-required-gaps" /></div><div className="border border-white/10 bg-[#121212] p-5"><h3 className="text-sm font-semibold text-white">{copy.conditionalGaps}</h3><GapList values={conditionalGaps} copy={copy} testId="review-conditional-gaps" /></div><div className="border border-white/10 bg-[#121212] p-5"><h3 className="text-sm font-semibold text-white">{copy.unknownBlocking}</h3><GapList values={unknownBlocking} copy={copy} testId="review-unknown-blocking" /></div><div className="border border-white/10 bg-[#121212] p-5"><h3 className="text-sm font-semibold text-white">{copy.gaps}</h3><GapList values={blockingGaps} copy={copy} testId="review-blocking-gaps" /></div></div>
    <div className="space-y-4" data-testid="review-summary"><h3 className="text-sm font-semibold text-white">{copy.summary}</h3>{REVIEW_SUMMARY_GROUPS.map((group) => <details key={group.label} open className="border border-white/10 bg-[#121212] p-4"><summary className="cursor-pointer text-xs font-mono uppercase tracking-widest text-zinc-400">{group.label}</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{group.keys.map((key) => { const item = summary[key]; if (!item) return null; return <div key={key} className="border border-white/10 p-3" data-testid={`review-summary-${key}`}><p className="text-[10px] uppercase tracking-widest text-zinc-600">{copy[key] || key}</p><p className="mt-2 text-sm text-zinc-200">{summaryValue(item, copy)}</p><p className="mt-1 text-[10px] font-mono text-zinc-600">{item.status}</p></div>; })}</div></details>)}</div>
    <details open className="border border-emerald-500/20 bg-[#121212] p-4" data-testid="review-confirmed"><summary className="cursor-pointer text-sm font-semibold text-emerald-200">{copy.confirmedState} ({confirmed.length})</summary><div className="mt-4"><ReviewDecisionList decisions={confirmed} questionCatalog={questionCatalog} copy={copy} onEdit={onEdit} canEdit={review.can_edit} emptyText={copy.noItems} /></div></details>
    <details open className="border border-amber-500/20 bg-[#121212] p-4" data-testid="review-unknown"><summary className="cursor-pointer text-sm font-semibold text-amber-200">{copy.unknownSection} ({unknown.length})</summary><div className="mt-4"><ReviewDecisionList decisions={unknown} questionCatalog={questionCatalog} copy={copy} onEdit={onEdit} canEdit={review.can_edit} emptyText={copy.noItems} /></div></details>
    <details open className="border border-sky-500/20 bg-[#121212] p-4" data-testid="review-not-required"><summary className="cursor-pointer text-sm font-semibold text-sky-200">{copy.notRequiredSection} ({notRequired.length})</summary><div className="mt-4"><ReviewDecisionList decisions={notRequired} questionCatalog={questionCatalog} copy={copy} onEdit={onEdit} canEdit={review.can_edit} emptyText={copy.noItems} /></div></details>
    <details className="border border-white/10 bg-[#121212] p-4" data-testid="review-history"><summary className="cursor-pointer text-sm font-semibold text-zinc-300">{copy.history} ({(data.decision_history || []).length})</summary><div className="mt-4 space-y-2">{(data.decision_history || []).map((decision) => <div key={`${decision.question_id}-${decision.decided_at}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 text-xs text-zinc-400"><span>{decision.question_id}</span><span>{decision.status}{decision.value ? ` · ${decision.value}` : ""}</span></div>)}</div></details>
    <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-zinc-500">Catalog {review.catalog_version || "—"}</p><button type="button" disabled aria-disabled="true" className="min-h-11 border border-white/10 px-5 text-sm font-semibold text-zinc-500 disabled:cursor-not-allowed" data-testid="review-confirm-action">{copy.readyForConfirmation}<span className="ml-2 text-[10px] font-normal">{copy.confirmationNext}</span></button></div>
  </section>;
}

function GapList({ values, copy, testId }) {
  return <div data-testid={testId}>{values.length ? <ul className="mt-3 space-y-2 text-sm text-zinc-300">{values.map((value) => <li key={value}>• {value}</li>)}</ul> : <p className="mt-3 text-sm text-zinc-500">{copy.noItems}</p>}</div>;
}

function LoadingState({ copy }) {
  return <div className="space-y-4" data-testid="guided-loading-state" aria-live="polite"><p className="text-sm text-zinc-500">{copy.loading}</p><Skeleton className="h-44 w-full bg-white/10" /><Skeleton className="h-44 w-full bg-white/10" /></div>;
}

function ProgressItem({ label, value }) {
  return <div className="border border-white/10 bg-[#121212] p-4" data-testid={`guided-progress-${label.toLowerCase().replace(/\s+/g, "-")}`}><p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">{label}</p><p className="mt-2 break-words text-sm font-semibold text-zinc-200">{value}</p></div>;
}

export default function GuidedDiscoveryPage() {
  const { id } = useParams();
  const { lang } = useLang();
  const copy = t[lang];
  const [project, setProject] = useState(null);
  const [discovery, setDiscovery] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionCatalog, setQuestionCatalog] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [draftDecisions, setDraftDecisions] = useState({});
  const [editingIds, setEditingIds] = useState({});
  const [requestState, setRequestState] = useState("loading");
  const [submissionState, setSubmissionState] = useState("idle");
  const [error, setError] = useState(null);
  const questionCatalogRef = useRef({});
  const submissionRef = useRef(false);

  const applyDiscovery = useCallback(async (payload, signal) => {
    const disc = payload.discovery || {};
    const responseQuestions = payload.questions || [];
    const activeIds = responseQuestions.length > 0 ? responseQuestions.map(questionIdOf) : disc.active_question_ids || [];
    const storedQuestions = responseQuestions.length > 0 ? responseQuestions : (disc.questions || []).filter((question) => activeIds.includes(questionIdOf(question)));
    const catalog = { ...questionCatalogRef.current };
    [...(disc.questions || []), ...responseQuestions].forEach((question) => {
      const questionId = questionIdOf(question);
      if (questionId) catalog[questionId] = { ...catalog[questionId], ...question, question_id: questionId };
    });
    questionCatalogRef.current = catalog;
    const hydrated = await Promise.all(storedQuestions.map(async (question) => {
      if (question.recommendations) return mergeQuestionRecommendations(question);
      try {
        const result = await getRecommendations(id, questionIdOf(question), { signal });
        return mergeQuestionRecommendations(question, result.data);
      } catch {
        return mergeQuestionRecommendations(question);
      }
    }));
    if (signal?.aborted) return;
    hydrated.forEach((question) => {
      catalog[questionIdOf(question)] = { ...catalog[questionIdOf(question)], ...question };
    });
    questionCatalogRef.current = catalog;
    setQuestionCatalog(Object.values(catalog));
    setDiscovery(payload);
    setQuestions(hydrated);
    setDecisions(payload.decisions || disc.decisions || []);
  }, [id]);

  const loadReview = useCallback(async (status) => {
    if (status === "none") {
      setReview(null);
      setReviewError(null);
      return false;
    }
    setReviewLoading(true);
    setReviewError(null);
    try {
      const response = await getDiscoveryReview(id);
      setReview(response.data);
      return true;
    } catch (err) {
      if (err.response?.status === 409) {
        try {
          const latestDiscovery = await getDiscovery(id);
          await applyDiscovery(latestDiscovery.data);
          const response = await getDiscoveryReview(id);
          setReview(response.data);
          return true;
        } catch (refreshError) {
          setReviewError(normalizeApiError(refreshError));
          return false;
        }
      }
      setReviewError(normalizeApiError(err));
      return false;
    } finally {
      setReviewLoading(false);
    }
  }, [applyDiscovery, id]);

  const load = useCallback(async (signal) => {
    setRequestState("loading");
    setError(null);
    try {
      const [projectResult, discoveryResult] = await Promise.all([api.get(`/projects/${id}`, { signal }), getDiscovery(id, { signal })]);
      if (discoveryResult.data.discovery?.mode !== "guided_discovery") throw Object.assign(new Error("Legacy discovery project"), { response: { status: 409 } });
      setProject(projectResult.data);
      await applyDiscovery(discoveryResult.data, signal);
      await loadReview(discoveryResult.data.discovery_status);
      if (!signal?.aborted) setRequestState("success");
    } catch (err) {
      if (!signal?.aborted) {
        setError(normalizeApiError(err));
        setRequestState("error");
      }
    }
  }, [applyDiscovery, id, loadReview]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const analyze = async () => {
    setRequestState("analyzing");
    setError(null);
    try {
      const response = await guidedAnalyze(id);
      await applyDiscovery(response.data);
      await loadReview(response.data.discovery_status);
      setRequestState("success");
    } catch (err) {
      setError(normalizeApiError(err));
      setRequestState("error");
    }
  };

  const refreshDiscovery = async () => {
    try {
      const response = await getDiscovery(id);
      await applyDiscovery(response.data);
      const activeIds = new Set(response.data.discovery?.active_question_ids || []);
      setDraftDecisions((current) => Object.fromEntries(Object.entries(current).filter(([questionId]) => activeIds.has(questionId))));
      await loadReview(response.data.discovery_status);
      return true;
    } catch (err) {
      setError(normalizeApiError(err));
      return false;
    }
  };

  const setDraft = (questionId, intent) => {
    setDraftDecisions((current) => ({ ...current, [questionId]: intent }));
  };

  const editDecision = (questionId) => {
    setEditingIds((current) => ({ ...current, [questionId]: true }));
    setDraftDecisions((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    const focusQuestion = () => {
      const card = [...document.querySelectorAll("[data-testid]")].find((item) => item.dataset.testid === `guided-question-card-${questionId}`);
      card?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      card?.querySelector("button, input, textarea")?.focus();
    };
    if (typeof window !== "undefined" && window.requestAnimationFrame) window.requestAnimationFrame(focusQuestion);
    else focusQuestion();
  };

  const cancelEdit = (questionId) => {
    setEditingIds((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    setDraftDecisions((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  };

  const authoritativeDecision = (questionId) => decisions.find((decision) => decision.question_id === questionId);
  const resolvedQuestions = decisions.map((decision) => questionCatalog.find((question) => questionIdOf(question) === decision.question_id) || { question_id: decision.question_id, id: decision.question_id, question: decision.question_id, type: "text", options: [] }).filter((question) => !questions.some((activeQuestion) => questionIdOf(activeQuestion) === questionIdOf(question)));
  const submissionQuestions = [...questions, ...resolvedQuestions.filter((question) => editingIds[questionIdOf(question)])].filter((question, index, list) => list.findIndex((item) => questionIdOf(item) === questionIdOf(question)) === index);
  const validationErrors = submissionQuestions.reduce((result, question) => {
    const draft = draftDecisions[questionIdOf(question)];
    const validationError = validateQuestionDraft(question, draft);
    if (validationError) result[questionIdOf(question)] = validationError;
    return result;
  }, {});
  const validDrafts = submissionQuestions.map((question) => sanitizeDraftDecision(question, draftDecisions[questionIdOf(question)])).filter(Boolean);
  const unansweredCount = questions.filter((question) => !authoritativeDecision(questionIdOf(question)) && !sanitizeDraftDecision(question, draftDecisions[questionIdOf(question)])).length;

  const submitBatch = async () => {
    if (submissionRef.current) return;
    if (Object.keys(validationErrors).length > 0) {
      setError(copy.invalid);
      return;
    }
    if (validDrafts.length === 0) {
      setError(copy.noDraft);
      return;
    }
    submissionRef.current = true;
    setSubmissionState("submitting");
    setError(null);
    try {
      const response = await submitGuidedDecisions(id, validDrafts);
      await applyDiscovery(response.data);
      await loadReview(response.data.discovery_status);
      setDraftDecisions({});
      setEditingIds({});
    } catch (err) {
      const message = normalizeApiError(err);
      setError(message);
      if ([400, 409, 422].includes(err.response?.status)) {
        const refreshed = await refreshDiscovery();
        if (refreshed) setError(`${message} ${copy.refreshed}`);
      }
    } finally {
      submissionRef.current = false;
      setSubmissionState("idle");
    }
  };

  const disc = discovery?.discovery || {};
  const readiness = discovery?.readiness || discovery?.completeness?.readiness;
  const gaps = discovery?.blocking_gaps || disc.blocking_gaps || [];
  const answeredCount = decisions.length;

  return (
    <AppLayout>
      <main className="w-full max-w-6xl p-4 pb-32 sm:p-6 lg:p-12" data-testid="guided-discovery-page" aria-busy={requestState === "loading" || requestState === "analyzing" || submissionState === "submitting"}>
        {requestState === "loading" && <LoadingState copy={copy} />}
        {requestState === "error" && !project && <div className="border border-red-500/30 bg-red-500/5 p-8" data-testid="guided-error-state" role="alert" aria-live="assertive"><AlertTriangle size={24} className="text-red-300" aria-hidden="true" /><p className="mt-4 text-sm text-red-200">{error}</p><button type="button" onClick={() => load()} className="btn-primary mt-6 min-h-11 px-5 py-2.5 text-sm font-semibold" data-testid="guided-retry-btn"><RefreshCw size={14} className="mr-2 inline" />{copy.reload}</button></div>}
        {project && <>
          <header className="max-w-3xl"><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo-300">{copy.eyebrow}</p><h1 className="mt-3 font-display text-3xl font-black tracking-tight md:text-4xl">{copy.title}</h1><p className="mt-2 text-sm leading-relaxed text-zinc-500">{copy.sub}</p><p className="mt-5 text-xs text-zinc-400"><span className="font-semibold text-white">{project.name}</span>{project.description ? ` · ${project.description}` : ""}</p></header>
          <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" aria-label="Discovery progress" data-testid="guided-progress"><ProgressItem label={copy.status} value={discovery?.discovery_status || "—"} /><ProgressItem label={copy.round} value={disc.analysis_rounds ?? "—"} /><ProgressItem label={copy.questions} value={questions.length} /><ProgressItem label={copy.answered} value={answeredCount} /><ProgressItem label={copy.readiness} value={readiness || "—"} /><ProgressItem label={copy.gaps} value={gaps.length} /></section>
          {error && <div className="mt-6 border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200" role="alert" aria-live="assertive" data-testid="guided-inline-error"><AlertTriangle size={16} className="mr-2 inline" aria-hidden="true" />{error}</div>}
          {requestState === "success" && !disc.active_question_ids?.length && !decisions.length && discovery?.discovery_status === "none" && <div className="mt-8 border border-indigo-500/20 bg-indigo-500/5 p-5 text-sm text-indigo-100" data-testid="guided-ready-state">{copy.ready}</div>}
          {discovery?.discovery_status === "confirmed" && <div className="mt-8 border border-emerald-500/30 bg-emerald-500/5 p-5 text-sm text-emerald-100" data-testid="guided-confirmed-state">{copy.confirmed}</div>}
          {(discovery?.discovery_status === "none" || (requestState === "error" && questions.length === 0 && decisions.length === 0)) && <button type="button" onClick={analyze} disabled={requestState === "analyzing" || submissionState === "submitting"} className="btn-primary mt-6 flex min-h-11 items-center gap-2 px-6 py-3 text-sm font-semibold disabled:opacity-50" data-testid="guided-analyze-btn" aria-busy={requestState === "analyzing"}>{requestState === "analyzing" ? <><Loader2 size={15} className="animate-spin" />{copy.analyzing}</> : <><Sparkles size={15} />{copy.analyze}</>}</button>}
          {requestState === "analyzing" && <div className="mt-8" data-testid="guided-analyzing-state"><LoadingState copy={copy} /></div>}
          {questions.length > 0 && <section className="mt-8 space-y-4" aria-label="Discovery questions" data-testid="guided-question-list">{questions.map((question) => <QuestionCard key={questionIdOf(question)} question={question} copy={copy} draft={draftDecisions[questionIdOf(question)]} serverDecision={authoritativeDecision(questionIdOf(question))} submitting={submissionState === "submitting"} editing={Boolean(editingIds[questionIdOf(question)])} validationError={validationErrors[questionIdOf(question)]} onDraft={(intent) => setDraft(questionIdOf(question), intent)} onEdit={editDecision} onCancelEdit={cancelEdit} />)}</section>}
          {(review || reviewLoading || reviewError) && <ReviewPanel review={review} reviewLoading={reviewLoading} reviewError={reviewError} questionCatalog={questionCatalog} copy={copy} onRefresh={() => loadReview(discovery?.discovery_status)} onEdit={editDecision} />}
          {resolvedQuestions.length > 0 && <section className="mt-10 space-y-4" aria-label="Server decisions" data-testid="guided-resolved-list"><div><p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Server decisions</p><p className="mt-1 text-xs text-zinc-500">Nilai dan status di bawah berasal dari response backend.</p></div>{resolvedQuestions.map((question) => { const questionId = questionIdOf(question); return <QuestionCard key={`resolved-${questionId}`} question={{ ...question, value: authoritativeDecision(questionId)?.value }} copy={copy} draft={draftDecisions[questionId]} serverDecision={authoritativeDecision(questionId)} submitting={submissionState === "submitting"} editing={Boolean(editingIds[questionId])} validationError={validationErrors[questionId]} onDraft={(intent) => setDraft(questionId, intent)} onEdit={editDecision} onCancelEdit={cancelEdit} />; })}</section>}
          {gaps.length > 0 && <section className="mt-8 border border-amber-500/20 bg-amber-500/5 p-5" data-testid="guided-blocking-gaps"><h2 className="text-xs font-mono uppercase tracking-widest text-amber-300">{copy.gaps}</h2><ul className="mt-3 space-y-1 text-sm text-zinc-300">{gaps.map((gap) => <li key={gap}>• {gap}</li>)}</ul></section>}
          {questions.length === 0 && requestState === "success" && discovery?.discovery_status !== "none" && discovery?.discovery_status !== "confirmed" && <div className="mt-8 border border-dashed border-white/15 p-8 text-sm text-zinc-500" data-testid="guided-empty-questions">{copy.noQuestions}</div>}
          {questions.length > 0 && <div className="sticky bottom-3 z-10 mt-8 flex flex-col gap-3 border border-indigo-500/25 bg-[#17131d]/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between" data-testid="guided-batch-actions" aria-busy={submissionState === "submitting"}><div><p className="text-sm font-semibold text-white">{unansweredCount} {copy.unanswered}</p><p className="mt-1 text-xs text-zinc-500">{validDrafts.length} {copy.pending}</p></div><button type="button" onClick={submitBatch} disabled={submissionState === "submitting" || validDrafts.length === 0 || Object.keys(validationErrors).length > 0} className="btn-primary flex min-h-11 items-center justify-center gap-2 px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" data-testid="guided-continue-btn" aria-busy={submissionState === "submitting"}>{submissionState === "submitting" ? <><Loader2 size={15} className="animate-spin" />{copy.analyzing}</> : <>{copy.continue} <Check size={15} /></>}</button></div>}
        </>}
      </main>
    </AppLayout>
  );
}
