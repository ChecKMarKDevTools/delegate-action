import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { CopilotProvider } from './copilot.js';

const PROVIDERS = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  copilot: CopilotProvider,
};

/**
 * Create an LLM provider instance by name.
 * @param {Object} options
 * @param {string} options.provider - Provider name (openai, anthropic, copilot)
 * @param {string} options.apiKey - API key for the provider
 * @param {string} [options.model] - Optional model override
 * @param {import('pino').Logger} options.logger - Pino logger instance
 * @returns {import('./provider.js').LLMProvider} Provider instance
 */
export function createProvider({ provider, apiKey, model, logger }) {
  const normalizedName = provider?.toLowerCase()?.trim();

  if (!normalizedName) {
    throw new Error('LLM_PROVIDER is required');
  }

  const ProviderClass = PROVIDERS[normalizedName];

  if (!ProviderClass) {
    const available = Object.keys(PROVIDERS).join(', ');
    throw new Error(`Unknown LLM provider: "${provider}". Available providers: ${available}`);
  }

  return new ProviderClass({ apiKey, model, logger });
}

export { LLMProvider } from './provider.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { CopilotProvider } from './copilot.js';
