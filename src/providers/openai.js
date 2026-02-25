import { LLMProvider } from './provider.js';

/**
 * OpenAI LLM Provider.
 * Uses the OpenAI Chat Completions API.
 */
export class OpenAIProvider extends LLMProvider {
  get defaultModel() {
    return 'gpt-4o';
  }

  get name() {
    return 'openai';
  }

  /**
   * @param {Object} options
   * @param {string} options.instructions - The prompt / instructions
   * @param {string|null} [options.fileContent] - Optional file content for context
   * @param {string|null} [options.fileName] - Optional file name for context
   * @returns {Promise<string>} Generated text
   */
  async generate({ instructions, fileContent = null, fileName = null }) {
    this.logger.info({ model: this.model, provider: this.name }, 'Sending request to OpenAI');

    const messages = [
      {
        role: 'system',
        content:
          'You are a senior software engineer. Follow the instructions precisely. ' +
          'Output only the code changes or text requested — no markdown fences unless asked.',
      },
    ];

    if (fileContent) {
      messages.push({
        role: 'user',
        content: `Here is the file "${fileName || 'unknown'}" for context:\n\n${fileContent}`,
      });
    }

    messages.push({ role: 'user', content: instructions });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI returned empty response');
    }

    this.logger.info(
      { model: this.model, tokensUsed: data.usage?.total_tokens },
      'OpenAI response received'
    );

    return content;
  }
}
