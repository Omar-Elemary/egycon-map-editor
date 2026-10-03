import { parseShareMap, shareIdFromProject } from "@/lib/share";
import type { MapProject } from "@/lib/types";

export type ShareResponse = {
  id: string;
  name: string;
  path: string;
  urls: string[];
  phoneUrl: string;
  published: boolean;
  live: boolean;
  expiresAt: string | null;
  manageToken?: string | null;
};

const tokenKey = (id: string) => `egycon-share-token:${id}`;

export function loadShareToken(projectId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(tokenKey(shareIdFromProject(projectId)));
}

export function saveShareToken(id: string, token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(tokenKey(id), token);
}

function shareHeaders(token?: string | null, expiresAt?: string | null): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Share-Token"] = token;
  if (expiresAt) headers["X-Share-Expires"] = expiresAt;
  return headers;
}

export async function publishShare(
  project: MapProject,
  options: { expiresAt?: string | null } = {},
): Promise<ShareResponse> {
  const token = loadShareToken(project.id);
  const response = await fetch("/api/share", {
    method: "POST",
    headers: shareHeaders(token, options.expiresAt),
    body: JSON.stringify(project),
  });
  const payload = (await response.json()) as ShareResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Publish failed");
  if (payload.manageToken) saveShareToken(payload.id, payload.manageToken);
  return payload;
}

export async function updateShare(
  id: string,
  patch: { published?: boolean; expiresAt?: string | null },
): Promise<ShareResponse> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(tokenKey(id)) : null;
  const response = await fetch(`/api/share/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: shareHeaders(token, patch.expiresAt),
    body: JSON.stringify(patch),
  });
  const payload = (await response.json()) as ShareResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not update share.");
  return payload;
}

export async function unpublishShare(id: string): Promise<ShareResponse> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(tokenKey(id)) : null;
  const response = await fetch(`/api/share/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: shareHeaders(token),
  });
  const payload = (await response.json()) as ShareResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not unpublish.");
  return payload;
}

export async function fetchShare(id: string): Promise<MapProject | null> {
  try {
    const response = await fetch(`/api/share/${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    return parseShareMap((await response.json()) as unknown);
  } catch {
    return null;
  }
}
