import { vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockProvider = {
    name: 'mock-provider',
    model: 'mock-model',
    generate: vi.fn().mockResolvedValue('Mock LLM response'),
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
    mockProvider,
    mockProviders: {
      createProvider: vi.fn().mockReturnValue(mockProvider),
      LLMProvider: class {},
    },
  };
});

export const { mockCore, mockExec, mockGitHub, mockProvider, mockProviders } = mocks;

vi.mock('@actions/core', () => mocks.mockCore);
vi.mock('@actions/exec', () => mocks.mockExec);
vi.mock('@actions/github', () => mocks.mockGitHub);
vi.mock('../src/providers/index.js', () => mocks.mockProviders);
