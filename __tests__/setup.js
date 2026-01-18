import { vi, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.INPUT_PRIVATE_TOKEN = 'test-token-12345';
  process.env.INPUT_FILENAME = '';
  process.env.INPUT_BRANCH = 'main';
  process.env.GITHUB_REPOSITORY = 'testowner/testrepo';
  process.env.GITHUB_ACTOR = 'testuser';
  process.env.GITHUB_REF = 'refs/heads/main';
});

vi.mock('@actions/core', () => ({
  getInput: vi.fn((name, opts) => {
    const value = process.env[`INPUT_${name.toUpperCase()}`] || '';
    if (opts?.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value;
  }),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@actions/exec', () => ({
  exec: vi.fn(async (cmd, args, opts) => {
    if (args?.includes('diff-index')) {
      return opts?.ignoreReturnCode ? 0 : 1;
    }
    return 0;
  }),
}));

vi.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'testowner',
      repo: 'testrepo',
    },
    actor: 'testuser',
    ref: 'refs/heads/main',
  },
  getOctokit: vi.fn(() => ({
    rest: {
      pulls: {
        create: vi.fn(async () => ({
          data: { number: 42, html_url: 'https://github.com/test/repo/pull/42' },
        })),
      },
      issues: {
        addAssignees: vi.fn(async () => ({})),
      },
    },
  })),
}));

vi.mock('../src/copilot-loader.js', () => ({
  getCopilotClient: vi.fn(async () => {
    return class MockCopilotClient {
      constructor() {
        this.started = false;
      }
      async start() {
        this.started = true;
      }
      async createSession() {
        return {
          sessionId: 'mock-session-123',
          on: vi.fn(),
          sendAndWait: vi.fn(async () => {}),
          destroy: vi.fn(async () => {}),
        };
      }
      async stop() {
        this.started = false;
      }
      async forceStop() {
        this.started = false;
      }
    };
  }),
}));
