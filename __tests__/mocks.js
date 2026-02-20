import { vi } from 'vitest';

// Each vi.resetModules() + reimport of src/index.js creates a new pino instance
// that adds process event listeners. Raise the limit to avoid false-positive warnings.
process.setMaxListeners(50);

const mocks = vi.hoisted(() => {
  const mockCopilotClient = class {
    started = false;
    async start() {
      this.started = true;
    }
    async createSession() {
      return {
        sessionId: 'mock-123',
        on: vi.fn(),
        sendAndWait: vi.fn().mockResolvedValue({ content: 'response' }),
        destroy: vi.fn(),
      };
    }
    async stop() {
      this.started = false;
    }
    async forceStop() {
      this.started = false;
    }
  };

  return {
    mockCore: {
      getInput: vi.fn(),
      setOutput: vi.fn(),
      setFailed: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
    mockExec: {
      exec: vi.fn(),
    },
    mockGitHub: {
      context: {
        repo: { owner: 'testowner', repo: 'testrepo' },
        actor: 'testuser',
        ref: 'refs/heads/main',
      },
      getOctokit: vi.fn(),
    },
    mockCopilotClient,
    mockCopilotLoader: {
      getCopilotClient: vi.fn().mockResolvedValue(mockCopilotClient),
    },
  };
});

export const { mockCore, mockExec, mockGitHub, mockCopilotClient, mockCopilotLoader } = mocks;

vi.mock('@actions/core', () => mocks.mockCore);
vi.mock('@actions/exec', () => mocks.mockExec);
vi.mock('@actions/github', () => mocks.mockGitHub);
vi.mock('../src/copilot-loader.js', () => mocks.mockCopilotLoader);
