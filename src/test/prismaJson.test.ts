import assert from "node:assert/strict";
import test from "node:test";
import { sanitizePrismaJson, stripUnsupportedText } from "@/lib/repositories/prismaJson";

test("sanitizePrismaJson normaliza valores incompatíveis com JSON/PostgreSQL", () => {
  const result = sanitizePrismaJson({
    ok: 1,
    nan: Number.NaN,
    infinity: Number.POSITIVE_INFINITY,
    missing: undefined,
    bigint: 42n,
    text: "A\u0000B",
    emoji: "✅",
    array: [1, undefined, Number.NaN],
  });

  assert.deepEqual(result, {
    ok: 1,
    nan: null,
    infinity: null,
    bigint: "42",
    text: "AB",
    emoji: "✅",
    array: [1, null, null],
  });
});

test("stripUnsupportedText remove NUL e surrogate isolado sem apagar emoji válido", () => {
  assert.equal(stripUnsupportedText("A\u0000B"), "AB");
  assert.equal(stripUnsupportedText("✅"), "✅");
  assert.equal(stripUnsupportedText(`A${String.fromCharCode(0xD800)}B`), "AB");
});

test("sanitizePrismaJson rejeita estrutura circular", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.throws(() => sanitizePrismaJson(circular), /estrutura JSON circular/);
});
