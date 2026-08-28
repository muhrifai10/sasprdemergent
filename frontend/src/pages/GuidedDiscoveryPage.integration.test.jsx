/* global afterEach, expect, jest, test */

jest.mock("react-router-dom", () => ({ useParams: () => ({ id: "project-1" }) }), { virtual: true });
jest.mock("../context/LanguageContext", () => ({ useLang: () => ({ lang: "en" }) }));
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

jest.mock("../lib/api", () => ({
  api: { get: jest.fn() },
  getDiscovery: jest.fn(),
  getDiscoveryReview: jest.fn(),
  getRecommendations: jest.fn(),
  guidedAnalyze: jest.fn(),
  submitGuidedDecisions: jest.fn(),
  normalizeApiError: (error) => error.response?.data?.detail?.code === "STALE_QUESTION" ? "This answer is stale." : error.message || "Request failed.",
}));

import { act } from "react";
import { createRoot } from "react-dom/client";
import * as apiModule from "../lib/api";
import GuidedDiscoveryPage from "./GuidedDiscoveryPage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockApiGet = apiModule.api.get;
const mockGetDiscovery = apiModule.getDiscovery;
const mockGetDiscoveryReview = apiModule.getDiscoveryReview;
const mockGetRecommendations = apiModule.getRecommendations;
const mockSubmitGuidedDecisions = apiModule.submitGuidedDecisions;

const currentQuestion = {
  id: "database.selection",
  question: "Which database should be used?",
  type: "single_choice",
  options: ["PostgreSQL", "Unknown"],
  required: true,
  category: "technology",
};

const nextQuestion = {
  question_id: "technology.backend",
  question: "Which backend technology should be used?",
  type: "single_choice",
  options: ["FastAPI", "Unknown"],
  recommendations: [{ id: "technology.backend.fastapi", value: "FastAPI", label: "FastAPI", reason: "Fits API workflows", tradeoffs: [] }],
  required: true,
  category: "technology",
  allow_custom: true,
  allow_unknown: true,
};

let roots = [];

function snapshot({ activeIds = ["database.selection"], questions = [currentQuestion], status = "in_progress", readiness = "in_progress", gaps = ["technology"] } = {}) {
  return {
    data: {
      mode: "guided_discovery",
      discovery_status: status,
      readiness,
      blocking_gaps: gaps,
      completeness: { readiness },
      questions: questions.filter((question) => activeIds.includes(question.question_id || question.id)),
      discovery: { mode: "guided_discovery", active_question_ids: activeIds, questions, decisions: [], analysis_rounds: 1, blocking_gaps: gaps },
    },
  };
}

async function mountPage(discovery = snapshot()) {
  mockApiGet.mockResolvedValue({ data: { id: "project-1", name: "Test project", description: "An idea" } });
  mockGetDiscovery.mockResolvedValue(discovery);
  mockGetDiscoveryReview.mockResolvedValue({ data: reviewSnapshot() });
  mockGetRecommendations.mockResolvedValue({ data: { recommendations: [{ id: "database.selection.postgresql", value: "PostgreSQL", label: "PostgreSQL", reason: "Safe default", tradeoffs: [] }] } });
  const container = document.createElement("div");
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<GuidedDiscoveryPage />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return container;
}

function reviewSnapshot({ decisions = [], readiness = "in_progress", blockingGaps = ["technology"] } = {}) {
  return {
    data: {
      review: {
        readiness,
        catalog_version: "1.0",
        summary: {},
        user_decisions: decisions,
      },
      completeness: { readiness, required_missing: [], conditional_missing: [], unknown: [] },
      readiness,
      blocking_gaps: blockingGaps,
      catalog_version: "1.0",
      can_edit: true,
      can_confirm: readiness === "ready_for_review",
    },
  };
}

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  jest.clearAllMocks();
});

test("batch submits only valid drafts and rehydrates the next server snapshot", async () => {
  const response = snapshot({ activeIds: ["technology.backend"], questions: [currentQuestion, nextQuestion], readiness: "ready_for_review", gaps: [] });
  response.data.decisions = [{ question_id: "database.selection", value: "PostgreSQL", status: "CONFIRMED" }];
  mockSubmitGuidedDecisions.mockResolvedValue(response);
  const container = await mountPage();

  expect(container.querySelector('[data-testid="guided-resolved-list"]')).toBeNull();
  act(() => container.querySelector('[data-testid="guided-recommendation-database.selection.postgresql"]').click());
  act(() => container.querySelector('[data-testid="guided-continue-btn"]').click());
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });

  expect(mockSubmitGuidedDecisions).toHaveBeenCalledWith("project-1", [{ question_id: "database.selection", type: "recommendation", recommendation_id: "database.selection.postgresql" }]);
  expect(mockSubmitGuidedDecisions.mock.calls[0][1][0]).not.toEqual(expect.objectContaining({ status: expect.anything(), source: expect.anything(), canonical: expect.anything(), inferred: expect.anything() }));
  expect(container.textContent).toContain("Confirmed");
  expect(container.textContent).toContain("PostgreSQL");
  expect(container.querySelector('[data-testid="guided-question-card-technology.backend"]')).toBeTruthy();
  expect(container.querySelector('[data-testid="guided-progress-readiness"]').textContent).toContain("ready_for_review");
  expect(container.querySelector('[data-testid="guided-question-list"] [data-testid="guided-question-card-database.selection"]')).toBeNull();
  expect(container.querySelector('[data-testid="guided-question-card-database.selection"]')).toBeTruthy();
  expect(mockGetDiscoveryReview).toHaveBeenCalledTimes(2);
});

test("duplicate continue clicks are blocked while batch request is pending", async () => {
  let resolveSubmit;
  mockSubmitGuidedDecisions.mockReturnValue(new Promise((resolve) => { resolveSubmit = resolve; }));
  const container = await mountPage();
  act(() => container.querySelector('[data-testid="guided-recommendation-database.selection.postgresql"]').click());
  act(() => {
    const button = container.querySelector('[data-testid="guided-continue-btn"]');
    button.click();
    button.click();
  });
  expect(mockSubmitGuidedDecisions).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-testid="guided-continue-btn"]').disabled).toBe(true);
  await act(async () => { resolveSubmit(snapshot({ activeIds: [], questions: [], status: "awaiting_confirmation", readiness: "ready_for_review", gaps: [] })); await Promise.resolve(); });
});

test("stale batch failure refreshes discovery and keeps unsent draft state", async () => {
  mockSubmitGuidedDecisions.mockRejectedValue({ response: { status: 409, data: { detail: { code: "STALE_QUESTION" } } } });
  mockGetDiscovery.mockResolvedValueOnce(snapshot()).mockResolvedValueOnce(snapshot());
  const container = await mountPage();
  act(() => container.querySelector('[data-testid="guided-recommendation-database.selection.postgresql"]').click());
  act(() => container.querySelector('[data-testid="guided-continue-btn"]').click());
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

  expect(mockGetDiscovery).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain("This answer is stale.");
  expect(container.querySelector('[data-testid="guided-draft-database.selection"]')).toBeTruthy();
});

test("review renders backend readiness, confirmed provenance, and blocking gaps", async () => {
  mockGetDiscoveryReview.mockResolvedValueOnce(reviewSnapshot({
    readiness: "ready_for_review",
    blockingGaps: [],
    decisions: [{ question_id: "database.selection", value: "PostgreSQL", status: "CONFIRMED", source: "USER_RECOMMENDATION_SELECTION" }],
  }));
  const container = await mountPage();

  expect(container.querySelector('[data-testid="review-panel"]')).toBeTruthy();
  expect(container.querySelector('[data-testid="review-readiness"]').textContent).toContain("Ready for review");
  expect(container.querySelector('[data-testid="review-decision-database.selection"]').textContent).toContain("Recommendation selected");
  expect(container.querySelector('[data-testid="review-blocking-gaps"]').textContent).toContain("No items.");
  expect(container.querySelector('[data-testid="review-confirm-action"]').disabled).toBe(true);
});

test("review separates unknown and not-required decisions without treating them as missing", async () => {
  mockGetDiscoveryReview.mockResolvedValueOnce(reviewSnapshot({
    decisions: [
      { question_id: "technology.frontend", value: "", status: "UNKNOWN", source: "USER_UNKNOWN_SELECTION" },
      { question_id: "scope.shipping", value: "", status: "NOT_REQUIRED", source: "USER_NOT_REQUIRED_SELECTION" },
    ],
    blockingGaps: [],
  }));
  const container = await mountPage();

  expect(container.querySelector('[data-testid="review-unknown"]').textContent).toContain("Not determined");
  expect(container.querySelector('[data-testid="review-not-required"]').textContent).toContain("Not required");
  expect(container.querySelector('[data-testid="review-blocking-gaps"]').textContent).toContain("No items.");
  expect(container.querySelector('[data-testid="review-readiness"]').className).toContain("border-amber");
});

test("review edit uses question_id and returns to the existing question UI", async () => {
  mockGetDiscoveryReview.mockResolvedValueOnce(reviewSnapshot({ decisions: [{ question_id: "database.selection", value: "PostgreSQL", status: "CONFIRMED", source: "USER_CUSTOM" }] }));
  const container = await mountPage();
  act(() => container.querySelector('[data-testid="review-edit-database.selection"]').click());

  expect(container.querySelector('[data-testid="guided-recommendation-database.selection.postgresql"]')).toBeTruthy();
  expect(mockSubmitGuidedDecisions).not.toHaveBeenCalled();
});

test("stale review refreshes discovery before retrying the review request", async () => {
  mockGetDiscoveryReview.mockRejectedValueOnce({ response: { status: 409, data: { detail: { code: "STALE_REVIEW" } } } }).mockResolvedValueOnce(reviewSnapshot());
  const container = await mountPage();

  expect(mockGetDiscovery).toHaveBeenCalledTimes(2);
  expect(mockGetDiscoveryReview).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[data-testid="review-panel"]')).toBeTruthy();
});
