/* global afterEach, expect, jest, test */

jest.mock("react-router-dom", () => ({ useParams: () => ({ id: "test-project" }) }), { virtual: true });
jest.mock("../components/AppLayout", () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock("../components/ui/badge", () => ({ Badge: ({ children, ...props }) => <div {...props}>{children}</div> }));
jest.mock("../components/ui/card", () => ({
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
}));
jest.mock("../components/ui/skeleton", () => ({ Skeleton: () => null }));

import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  buildDecisionIntent,
  QuestionCard,
  sanitizeDraftDecision,
  validateQuestionDraft,
} from "./GuidedDiscoveryPage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const copy = {
  required: "Required",
  confirmedState: "Confirmed",
  unknownState: "Not determined",
  notRequiredState: "Not required",
  input: "Input",
  recommended: "Recommended",
  answerOwn: "Answer yourself",
  customPlaceholder: "Write your answer...",
  useCustom: "Use this answer",
  unknown: "I don't know",
  notRequired: "Not required",
  draft: "Selected for submission",
  edit: "Edit answer",
  cancel: "Cancel",
};

const recommendationQuestion = {
  question_id: "database.selection",
  category: "DATABASE",
  type: "single_choice",
  question: "Which database should be used?",
  options: ["PostgreSQL", "Other", "Unknown"],
  recommendations: [{ id: "database.selection.postgresql", value: "PostgreSQL", label: "PostgreSQL", reason: "Good default", tradeoffs: ["Needs hosting"] }],
  allow_custom: true,
  allow_unknown: true,
  allow_not_required: false,
  required: true,
};

let roots = [];

function renderCard(question, props = {}) {
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(<QuestionCard question={question} copy={copy} onDraft={jest.fn()} {...props} />));
  return container;
}

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
});

test("recommendations render their label, reason, and tradeoffs", () => {
  const container = renderCard(recommendationQuestion);

  expect(container.textContent).toContain("PostgreSQL");
  expect(container.textContent).toContain("Good default");
  expect(container.textContent).toContain("Needs hosting");
});

test("textarea questions render catalog recommendations alongside custom input", () => {
  const question = {
    question_id: "target.users",
    category: "TARGET_USERS",
    type: "textarea",
    recommendations: [{ id: "target.users.owner", value: "Owner", label: "Owner", reason: "Common owner role", tradeoffs: [] }],
    allow_custom: true,
    allow_unknown: true,
    allow_not_required: false,
  };
  const container = renderCard(question);

  expect(container.querySelector('[data-testid="guided-recommendations-target.users"]')).toBeTruthy();
  expect(container.textContent).toContain("Owner");
  expect(container.querySelector('[data-testid="guided-custom-input-target.users"]')).toBeTruthy();
  expect(container.querySelector('[data-testid="guided-unknown-target.users"]')).toBeTruthy();
});

test("questions without recommendations still render without a recommendation panel", () => {
  const container = renderCard({ ...recommendationQuestion, question_id: "workflow.primary", type: "textarea", recommendations: [] });

  expect(container.querySelector('[data-testid="guided-recommendations-workflow.primary"]')).toBeNull();
  expect(container.querySelector('[data-testid="guided-custom-input-workflow.primary"]')).toBeTruthy();
});

test("recommendation selection emits only the client intent", () => {
  const onDraft = jest.fn();
  const container = renderCard(recommendationQuestion, { onDraft });

  act(() => container.querySelector('[data-testid="guided-recommendation-database.selection.postgresql"]').click());

  expect(onDraft).toHaveBeenCalledWith({ question_id: "database.selection", type: "recommendation", recommendation_id: "database.selection.postgresql" });
  expect(onDraft.mock.calls[0][0]).not.toEqual(expect.objectContaining({ status: expect.anything(), source: expect.anything(), canonical_value: expect.anything(), inferred: expect.anything() }));
});

test("custom, unknown, and not-required intents use the expected shapes", () => {
  expect(buildDecisionIntent("q", "custom", "answer")).toEqual({ question_id: "q", type: "custom", value: "answer" });
  expect(buildDecisionIntent("q", "unknown")).toEqual({ question_id: "q", type: "unknown" });
  expect(buildDecisionIntent("q", "not_required")).toEqual({ question_id: "q", type: "not_required" });
});

test("custom input is disabled when empty and can produce a custom intent", () => {
  const onDraft = jest.fn();
  const container = renderCard(recommendationQuestion, { onDraft });
  const input = container.querySelector('[data-testid="guided-custom-input-database.selection"]');
  const submit = container.querySelector('[data-testid="guided-custom-submit-database.selection"]');

  expect(submit.disabled).toBe(true);
  act(() => onDraft(buildDecisionIntent("database.selection", "custom", "MariaDB")));
  expect(sanitizeDraftDecision(recommendationQuestion, { question_id: "database.selection", type: "custom", value: "MariaDB" })).toEqual({ question_id: "database.selection", type: "custom", value: "MariaDB" });
  expect(input).toBeTruthy();
});

test("unknown is rendered only when allowed", () => {
  const onDraft = jest.fn();
  const container = renderCard(recommendationQuestion, { onDraft });
  act(() => container.querySelector('[data-testid="guided-unknown-database.selection"]').click());
  expect(onDraft).toHaveBeenCalledWith({ question_id: "database.selection", type: "unknown" });

  const hidden = renderCard({ ...recommendationQuestion, allow_unknown: false });
  expect(hidden.querySelector('[data-testid="guided-unknown-database.selection"]')).toBeNull();
});

test("not-required is rendered and selectable only when allowed", () => {
  const question = { ...recommendationQuestion, allow_unknown: false, allow_not_required: true };
  const onDraft = jest.fn();
  const container = renderCard(question, { onDraft });
  act(() => container.querySelector('[data-testid="guided-not-required-database.selection"]').click());
  expect(onDraft).toHaveBeenCalledWith({ question_id: "database.selection", type: "not_required" });
});

test("multi-choice selections remain a custom value instead of recommendation IDs", () => {
  const question = { ...recommendationQuestion, question_id: "payment.method", type: "multi_choice", options: ["Cash", "QRIS"], recommendations: [] };
  const onDraft = jest.fn();
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  let draft;
  const render = () => root.render(<QuestionCard question={question} copy={copy} draft={draft} onDraft={(intent) => { draft = intent; onDraft(intent); render(); }} />);
  act(() => render());
  act(() => container.querySelector('[data-testid="guided-option-payment.method-Cash"]').click());
  act(() => container.querySelector('[data-testid="guided-option-payment.method-QRIS"]').click());
  expect(onDraft).toHaveBeenLastCalledWith({ question_id: "payment.method", type: "custom", value: "Cash + QRIS" });
});

test("authoritative confirmed, unknown, and not-required states show values without active inputs", () => {
  const confirmed = renderCard(recommendationQuestion, { serverDecision: { status: "CONFIRMED", value: "PostgreSQL" } });
  expect(confirmed.textContent).toContain("Confirmed");
  expect(confirmed.textContent).toContain("PostgreSQL");
  expect(confirmed.querySelector('[data-testid="guided-recommendation-database.selection.postgresql"]')).toBeNull();

  const unknown = renderCard({ ...recommendationQuestion, question_id: "q-unknown" }, { serverDecision: { status: "UNKNOWN", value: "" } });
  expect(unknown.textContent).toContain("Not determined");
  const excluded = renderCard({ ...recommendationQuestion, question_id: "q-excluded" }, { serverDecision: { status: "NOT_REQUIRED", value: "" } });
  expect(excluded.textContent).toContain("Not required");
});

test("draft validation follows question type and size limits", () => {
  expect(validateQuestionDraft({ ...recommendationQuestion, type: "number" }, { type: "custom", value: "not-a-number" })).toBe("Masukkan angka yang valid.");
  expect(validateQuestionDraft(recommendationQuestion, { type: "custom", value: "" })).toBe("Jawaban tidak boleh kosong.");
  expect(validateQuestionDraft(recommendationQuestion, { type: "custom", value: "x".repeat(2001) })).toBe("Jawaban terlalu panjang.");
  expect(validateQuestionDraft(recommendationQuestion, { type: "not_required" })).toBe("Pilihan ini tidak tersedia untuk pertanyaan ini.");
});
