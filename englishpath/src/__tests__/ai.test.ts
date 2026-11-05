import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const parse = vi.fn();
vi.mock("@/native/secrets", () => ({ getApiKey: async () => "sk-ant-test-key-aaaaaaaaaaaaaaaaaaaaaaaa" }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class APIConnectionError extends APIError {}
  class Anthropic {
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static APIConnectionError = APIConnectionError;
    beta = { messages: { parse } };
    messages = { create: vi.fn() };
  }
  return { default: Anthropic };
});
vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({ zodOutputFormat: () => ({ type: "json_schema" }) }));

const { generateJson, GenerationError } = await import("@/engine/ai/client");
const Schema = z.object({ word: z.string().min(1), level: z.enum(["A1", "B1"]) });

describe("AI generation (strict JSON + Zod)", () => {
  beforeEach(() => parse.mockReset());

  it("returns validated data", async () => {
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { word: "apple", level: "A1" } });
    await expect(generateJson({ schema: Schema, system: "s", prompt: "p", model: "claude-opus-5-5" })).resolves.toEqual({ word: "apple", level: "A1" });
    const req = parse.mock.calls[0]![0];
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.fallbacks).toBe("default");
  });

  it("retries exactly once on invalid JSON, telling the model what was wrong", async () => {
    parse
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { word: "", level: "Z9" } })
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { word: "tree", level: "B1" } });
    await expect(generateJson({ schema: Schema, system: "s", prompt: "p", model: "claude-haiku-5-5" })).resolves.toEqual({ word: "tree", level: "B1" });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[1]![0].messages.at(-1).content).toMatch(/previous answer was rejected/);
  });

  it("gives up after the single retry", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    await expect(generateJson({ schema: Schema, system: "s", prompt: "p", model: "claude-opus-5-5" })).rejects.toBeInstanceOf(GenerationError);
    expect(parse).toHaveBeenCalledTimes(2);
  });
});
