/**
 * Base LLM Provider interface.
 * All provider implementations must extend this class and implement generate().
 */
export class LLMProvider {
  /**
   * @param {Object} options
   * @param {string} options.apiKey - API key for the provider
   * @param {string} [options.model] - Model identifier override
   * @param {import('pino').Logger} options.logger - Pino logger instance
   */
  constructor({ apiKey, model, logger }) {
    if (new.target === LLMProvider) {
      throw new Error('LLMProvider is abstract and cannot be instantiated directly');
    }
    if (!apiKey) {
      throw new Error('apiKey is required');
    }
    this.apiKey = apiKey;
    this.model = model || this.defaultModel;
    this.logger = logger;
  }

  /**
   * Default model identifier — subclasses must override.
   * @returns {string}
   */
  get defaultModel() {
    throw new Error('Subclass must define defaultModel');
  }

  /**
   * Provider display name — subclasses must override.
   * @returns {string}
   */
  get name() {
    throw new Error('Subclass must define name');
  }

  /**
   * Generate a response from the LLM.
   * @param {Object} options
   * @param {string} options.instructions - The prompt / instructions to send
   * @param {string|null} [options.fileContent] - Optional file content for context
   * @param {string|null} [options.fileName] - Optional file name for context
   * @returns {Promise<string>} The generated response text
   */
  async generate(_options) {
    throw new Error('Subclass must implement generate()');
  }
}
