export function supportsLegacyGeminiSamplingParameters(model: string) {
  return !/^gemini-3(?:[.-]|$)/i.test(model.trim());
}
