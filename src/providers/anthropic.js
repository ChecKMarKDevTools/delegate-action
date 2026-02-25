import { LLMProvider } from './provider.js';

/**
 * Anthropic LLM Provider.
 * Uses the Anthropic Messages API.
 */
export class AnthropicProvider extends LLMProvider {
  get defaultModel() {
    return 'claude-sonnet-4-20250514';
  }

  get name() {
    return 'anthropic';
  }

  /**
   * @param {Object} options
   * @param {string} options.instructions - The prompt / instructions
   * @param {string|null} [options.fileContent] - Optional file content for context
   * @param {string|null} [options.fileName] - Optional file name for context
   * @returns {Promise<string>} Generated text
   */
  async generate({ instructions, fileContent = null, fileName = null }) {
    this.logger.info({ model: this.model, provider: this.name }, 'Sending request to Anthropic');

    const userParts = [];

    if (fileContent) {
      userParts.push(`Here is the file "${fileName || 'unknown'}" for context:\n\n${fileContent}`);
    }

    userParts.push(instructions);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        system:
          'You are a senior software engineer. Follow the instructions precisely. ' +
          'Output only the code changes or text requested — no markdown fences unless asked.',
        messages: [{ role: 'user', content: userParts.join('\n\n') }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('Anthropic returned empty response');
    }

    this.logger.info(
      {
        model: this.model,
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
      },
      'Anthropic response received'
    );

    return content;
  }
}
