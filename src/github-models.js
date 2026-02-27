/**
 * GitHub Models API client
 *
 * Uses the GitHub Models inference endpoint with GITHUB_TOKEN authentication.
 * Requires `models: read` permission in the workflow.
 *
 * @see https://github.blog/changelog/2025-05-15-introducing-the-models-api/
 */

const GITHUB_MODELS_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';

const SYSTEM_PROMPT =
  'You are a senior software engineer. Follow the instructions precisely. ' +
  'Output only the code changes or text requested — no markdown fences unless asked.';

/**
 * Create a GitHub Models client bound to a token and optional model override.
 * @param {{ token: string, model?: string, logger: import('pino').Logger }} opts
 * @returns {{ generate: Function, name: string, model: string }}
 */
export function createGitHubModelsClient({ token, model, logger }) {
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN is required for GitHub Models API. ' +
        'Ensure the workflow has `permissions: models: read`.'
    );
  }

  const resolvedModel = model || DEFAULT_MODEL;

  return {
    name: 'github-models',
    model: resolvedModel,

    /**
     * Send a chat completion request to GitHub Models.
     * @param {{ instructions: string, fileContent?: string|null, fileName?: string|null }} opts
     * @returns {Promise<string>} The model response text
     */
    async generate({ instructions, fileContent = null, fileName = null }) {
      const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

      if (fileContent) {
        messages.push({
          role: 'user',
          content: `Here is the file "${fileName || 'unknown'}" for context:\n\n${fileContent}`,
        });
      }

      messages.push({ role: 'user', content: instructions });

      logger.info(
        { model: resolvedModel, messageCount: messages.length },
        'Sending request to GitHub Models API'
      );

      const response = await fetch(GITHUB_MODELS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages,
          temperature: 0.2,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GitHub Models API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('GitHub Models API returned empty response');
      }

      logger.info(
        { model: resolvedModel, responseLength: content.length },
        'GitHub Models API response received'
      );

      return content;
    },
  };
}
