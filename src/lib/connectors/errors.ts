export class PlatformResourceUnavailableError extends Error {
  readonly publicMessage = "Este recurso está temporariamente indisponível. Tente novamente mais tarde.";

  constructor() {
    super("A capacidade solicitada não está disponível.");
    this.name = "PlatformResourceUnavailableError";
  }
}
