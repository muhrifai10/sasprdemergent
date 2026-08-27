import axios from "axios";

export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

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
