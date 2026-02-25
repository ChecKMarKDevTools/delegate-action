import { LLMProvider } from './provider.js';

/**
 * Legacy Copilot LLM Provider.
 * Wraps the @github/copilot SDK to preserve backward compatibility
 * for users who still have OAuth/PAT-based Copilot access.
 */
export class CopilotProvider extends LLMProvider {
  get defaultModel() {
    return 'gpt-5';
  }

  get name() {
    return 'copilot';
  }

  /**
   * @param {Object} options
   * @param {string} options.instructions - The prompt / instructions
   * @param {string|null} [options.fileContent] - Optional file content for context
   * @param {string|null} [options.fileName] - Optional file name for context
   * @returns {Promise<string>} Generated text (always returns a confirmation string since
   *   the Copilot SDK applies changes directly to the filesystem)
   */
  async generate({ instructions, fileContent = null, fileName = null }) {
    this.logger.info({ model: this.model, provider: this.name }, 'Initializing Copilot SDK');

    const { CopilotClient } = await import('@github/copilot/sdk');

    const client = new CopilotClient({
      logLevel: 'info',
      autoStart: true,
      autoRestart: true,
    });

    try {
      await client.start();
      this.logger.info('Copilot client started');

      const session = await client.createSession({
        model: this.model,
        streaming: true,
        onPermissionRequest: async (request) => {
          this.logger.info({ requestKind: request.kind }, 'Permission requested');
          return { kind: 'approved' };
        },
      });

      this.logger.info({ sessionId: session.sessionId }, 'Session created');

      session.on((event) => {
        switch (event.type) {
          case 'assistant.message_delta':
            process.stdout.write(event.data.deltaContent);
            break;
          case 'assistant.message':
            this.logger.info('Assistant response completed');
            break;
          case 'tool.execution_start':
            this.logger.info({ toolName: event.data.toolName }, 'Tool execution started');
            break;
          case 'tool.execution_end':
            this.logger.info({ toolName: event.data.toolName }, 'Tool execution completed');
            break;
          case 'session.error':
            this.logger.error({ error: event.data.message }, 'Session error');
            break;
        }
      });

      const messageOptions = { prompt: instructions };

      if (fileContent && fileName) {
        messageOptions.attachments = [
          {
            type: 'file',
            path: fileName,
            displayName: fileName,
          },
        ];
      }

      this.logger.info(
        { instructionsLength: instructions.length },
        'Sending message to Copilot SDK'
      );
      await session.sendAndWait(messageOptions, 300000);

      this.logger.info('Copilot execution completed');

      await session.destroy();
      await client.stop();

      return 'Copilot SDK applied changes directly to the filesystem';
    } catch (error) {
      this.logger.error({ error: error.message, stack: error.stack }, 'Copilot SDK failed');

      try {
        await client.forceStop();
      } catch (stopError) {
        this.logger.error({ error: stopError.message }, 'Failed to stop Copilot client');
      }

      throw error;
    }
  }
}
