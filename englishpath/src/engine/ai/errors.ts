/** Error types for the AI engine (kept SDK-free so screens don't load the SDK at start-up). */
export class NoApiKeyError extends Error {
  constructor() {
    super("Add your Claude API key in Settings to generate new content.");
    this.name = "NoApiKeyError";
  }
}

export class GenerationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "GenerationError";
  }
}
