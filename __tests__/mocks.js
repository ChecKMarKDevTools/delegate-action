import { vi } from 'vitest';

// ── @actions/core ───────────────────────────────────────────────────
export const mockCore = {
  getInput: vi.fn(),
  setFailed: vi.fn(),
  setOutput: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  addPath: vi.fn(),
};

vi.mock('@actions/core', () => mockCore);

// ── @actions/exec ───────────────────────────────────────────────────
export const mockExec = { exec: vi.fn() };

vi.mock('@actions/exec', () => mockExec);

// ── @actions/github ─────────────────────────────────────────────────
export const mockGitHub = {
  context: {
    repo: { owner: 'testowner', repo: 'testrepo' },
    actor: 'testuser',
  },
  getOctokit: vi.fn(),
};

vi.mock('@actions/github', () => mockGitHub);

// ── github-models.js ────────────────────────────────────────────────
export const mockClient = {
  name: 'github-models',
  model: 'gpt-4o',
  generate: vi.fn(),
};

export const mockGitHubModels = {
  createGitHubModelsClient: vi.fn().mockReturnValue(mockClient),
};

vi.mock('../src/github-models.js', () => mockGitHubModels);
