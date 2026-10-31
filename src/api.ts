import type { AIResult, AIStatus, Memory, MemoryInput } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error("Can't reach the local archive. Is the FastAPI server running?");
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      message = typeof body.detail === "string" ? body.detail : message;
    } catch {
      // Keep the HTTP status message when the server response is not JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function jsonBody(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}

export const api = {
  memories(params: Record<string, string> = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
    return request<Memory[]>(`/api/memories${query.size ? `?${query}` : ""}`);
  },
  timeline(params: Record<string, string> = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
    return request<Memory[]>(`/api/timeline${query.size ? `?${query}` : ""}`);
  },
  memory(id: number) {
    return request<Memory>(`/api/memories/${id}`);
  },
  createMemory(payload: MemoryInput) {
    return request<Memory>("/api/memories", jsonBody(payload));
  },
  updateMemory(id: number, payload: MemoryInput) {
    return request<Memory>(`/api/memories/${id}`, {
      ...jsonBody(payload),
      method: "PUT",
    });
  },
  deleteMemory(id: number) {
    return request<void>(`/api/memories/${id}`, { method: "DELETE" });
  },
  uploadImage(id: number, file: File) {
    const body = new FormData();
    body.append("file", file);
    return request<Memory>(`/api/memories/${id}/image`, { method: "POST", body });
  },
  collections() {
    return request<string[]>("/api/collections");
  },
  createCollection(name: string) {
    return request<string[]>(`/api/collections?name=${encodeURIComponent(name)}`, {
      method: "POST",
    });
  },
  generate(task: string, text: string, question?: string) {
    return request<AIResult>("/api/ai/generate", jsonBody({ task, text, question }));
  },
  aiStatus() {
    return request<AIStatus>("/api/ai/status");
  },
  settings() {
    return request<{ model: string }>("/api/settings");
  },
  setModel(model: string) {
    return request<{ model: string }>("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
  },
};

