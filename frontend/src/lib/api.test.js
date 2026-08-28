/* global afterEach, expect, jest, test */

import axios from "axios";
import {
  createGuidedProject,
  getDiscovery,
  getRecommendations,
  guidedAnalyze,
  normalizeApiError,
} from "./api";

jest.mock("axios", () => {
  const client = { get: jest.fn(), post: jest.fn() };
  return { create: jest.fn(() => client), __client: client };
});

const client = axios.__client;

afterEach(() => jest.clearAllMocks());

test("guided API helpers use the backend discovery contract", () => {
  createGuidedProject({ name: "Test" });
  guidedAnalyze("project-1");
  getDiscovery("project-1");
  getRecommendations("project-1", "q_auth");

  expect(client.post).toHaveBeenNthCalledWith(1, "/projects", { name: "Test", discovery_mode: "guided_discovery" });
  expect(client.post).toHaveBeenNthCalledWith(2, "/projects/project-1/discovery/analyze", {}, {});
  expect(client.get).toHaveBeenNthCalledWith(1, "/projects/project-1/discovery", {});
  expect(client.get).toHaveBeenNthCalledWith(2, "/projects/project-1/discovery/recommendations", { params: { question_id: "q_auth" } });
});

test("API errors are normalized without exposing unsafe details", () => {
  expect(normalizeApiError({ response: { status: 401, data: {} } })).toBe("Sesi tidak valid atau akses ditolak.");
  expect(normalizeApiError({ response: { status: 404, data: {} } })).toBe("Project tidak ditemukan.");
  expect(normalizeApiError({ code: "ECONNABORTED" })).toBe("Permintaan timeout.");
  expect(normalizeApiError({ response: { status: 422, data: { detail: [{ msg: "Invalid question" }] } } })).toBe("Invalid question");
  expect(normalizeApiError({ response: { status: 502, data: { detail: "traceback: api key=secret" } } })).toBe("Terjadi kesalahan server.");
});
