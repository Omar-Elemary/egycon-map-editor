export function createId(prefix = "obj"): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}
