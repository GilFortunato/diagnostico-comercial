export function sanitizePrismaJson(value: unknown): unknown {
  return sanitize(value, new WeakSet<object>());
}

function sanitize(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;

  if (typeof value === "string") return stripUnsupportedText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen) ?? null);
  }

  if (typeof value === "object") {
    if (seen.has(value)) throw new TypeError("Não é possível persistir uma estrutura JSON circular.");
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const sanitized = sanitize(item, seen);
      if (sanitized !== undefined) output[stripUnsupportedText(key)] = sanitized;
    }
    seen.delete(value);
    return output;
  }

  return undefined;
}

export function stripUnsupportedText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}
