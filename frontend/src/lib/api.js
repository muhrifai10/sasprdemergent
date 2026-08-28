import axios from "axios";

export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

const SAFE_DETAIL_BLOCKLIST = /traceback|stack trace|api key|secret|token|password|credential|mongodb|localhost|file\s+"/i;

function safeDetail(value) {
  if (Array.isArray(value)) return value.map(safeDetail).filter(Boolean).join(" ") || null;
  if (value && typeof value === "object") return safeDetail(value.message || value.detail || value.msg);
  if (typeof value !== "string") return null;
  const detail = value.trim();
  return detail && !SAFE_DETAIL_BLOCKLIST.test(detail) ? detail : null;
}

export function normalizeApiError(error) {
  const status = error?.response?.status;
  const errorMessage = error?.message?.toLowerCase() || "";
  if (error?.code === "ECONNABORTED" || error?.code === "ERR_CANCELED" || error?.name === "AbortError" || errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
    return "Permintaan timeout.";
  }
  if (!error?.response) return "Tidak dapat terhubung ke server.";
  if (status === 401 || status === 403) return "Sesi tidak valid atau akses ditolak.";
  if (status === 404) return "Project tidak ditemukan.";
  if (status === 409 && error.response.data?.detail?.code === "STALE_QUESTION") return "Jawaban ini sudah tidak berlaku. Muat ulang pertanyaan.";
  if (status === 409) return "State project sudah berubah. Silakan muat ulang.";
  if (status >= 500) return "Terjadi kesalahan server.";

  const detail = error.response.data?.detail;
  const message = safeDetail(detail?.message) || safeDetail(detail) || safeDetail(error.response.data?.message);
  return message || "Permintaan tidak valid.";
}

export function createGuidedProject(fields) {
  return api.post("/projects", { ...fields, discovery_mode: "guided_discovery" });
}

export function guidedAnalyze(projectId, config = {}) {
  return api.post(`/projects/${projectId}/discovery/analyze`, {}, config);
}

export function getDiscovery(projectId, config = {}) {
  return api.get(`/projects/${projectId}/discovery`, config);
}

export function getRecommendations(projectId, questionId, config = {}) {
  return api.get(`/projects/${projectId}/discovery/recommendations`, { ...config, params: { question_id: questionId } });
}

export function submitGuidedDecision(projectId, intent) {
  return api.post(`/projects/${projectId}/discovery/decisions`, intent);
}

export function submitGuidedDecisions(projectId, decisions) {
  return api.post(`/projects/${projectId}/discovery/decisions/batch`, { decisions });
}

export function getDiscoveryReview(projectId, config = {}) {
  return api.get(`/projects/${projectId}/discovery/review`, config);
}

export function confirmDiscovery(projectId) {
  return api.post(`/projects/${projectId}/discovery/confirm`);
}

const POLL_INTERVAL = 2500;
const MAX_POLL_TIME = 10 * 60 * 1000;

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Generation polling aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Generation polling aborted", "AbortError"));
    }, { once: true });
  });
}

export async function streamGeneration(path, language, onChunk, { signal } = {}) {
  const startedAt = Date.now();
  const start = await api.post(path, { language }, { signal });
  const jobId = start.data.job_id;
  let previousContent = "";
  while (Date.now() - startedAt < MAX_POLL_TIME) {
    await wait(POLL_INTERVAL, signal);
    const res = await api.get(`/generations/${jobId}`, { signal });
    const { status, content, error } = res.data;
    if (content && content !== previousContent) {
      previousContent = content;
      onChunk(content);
    }
    if (status === "completed") return content;
    if (status === "failed") throw new Error(error || "Generation failed");
  }
  throw new Error("Generation timed out");
}
