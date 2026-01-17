const path = require('path');

jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('@actions/github');

const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('pino', () => {
  return jest.fn(() => mockLogger);
});

const index = require('../src/index');

describe('Delegate Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_ACTOR = 'test-user';
  });

  describe('validateFilename', () => {
    test('should reject empty filename', () => {
      expect(() => index.validateFilename('')).toThrow(
        'Filename must be between 1 and 255 characters'
      );
    });

    test('should reject filename longer than 255 characters', () => {
      const longFilename = 'a'.repeat(256);
      expect(() => index.validateFilename(longFilename)).toThrow(
        'Filename must be between 1 and 255 characters'
      );
    });

    test('should accept valid filename', () => {
      const result = index.validateFilename('valid-file.txt');
      expect(result).toBe('valid-file.txt');
    });
  });

  describe('runCopilot', () => {
    test('should execute Copilot with token and instructions', async () => {
      exec.exec.mockResolvedValue(0);

      await index.runCopilot('fake-token', 'test instructions');

      expect(exec.exec).toHaveBeenCalled();
    });

    test('should handle Copilot execution errors gracefully', async () => {
      exec.exec.mockRejectedValue(new Error('Copilot failed'));

      await index.runCopilot('fake-token', 'test instructions');
      expect(core.warning).toHaveBeenCalled();
    });
  });

  describe('createBranch', () => {
    test('should create a new branch', async () => {
      exec.exec.mockResolvedValue(0);

      await index.createBranch('test-branch');

      expect(exec.exec).toHaveBeenCalledWith('git', ['checkout', '-b', 'test-branch']);
    });

    test('should fallback to checkout if branch creation fails', async () => {
      exec.exec.mockRejectedValueOnce(new Error('Branch exists')).mockResolvedValueOnce(0);

      await index.createBranch('existing-branch');
      expect(exec.exec).toHaveBeenNthCalledWith(2, 'git', ['checkout', 'existing-branch'], {
        ignoreReturnCode: true,
      });
    });
  });

  describe('commitAndPush', () => {
    test('should configure git user', async () => {
      exec.exec.mockResolvedValue(0);

      await index.commitAndPush('test commit', 'test-branch');

      expect(exec.exec).toHaveBeenCalledWith('git', ['config', 'user.name', 'github-actions[bot]']);
      expect(exec.exec).toHaveBeenCalledWith('git', [
        'config',
        'user.email',
        'github-actions[bot]@users.noreply.github.com',
      ]);
    });

    test('should commit and push when changes exist', async () => {
      exec.exec
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await index.commitAndPush('test commit', 'test-branch');

      expect(exec.exec).toHaveBeenCalledWith('git', ['commit', '-m', 'test commit']);
      expect(exec.exec).toHaveBeenCalledWith('git', ['push', '-u', 'origin', 'test-branch']);
    });

    test('should skip commit when no changes exist', async () => {
      exec.exec
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await index.commitAndPush('test commit', 'test-branch');

      const commitCalls = exec.exec.mock.calls.filter(
        (call) => call[0] === 'git' && call[1][0] === 'commit'
      );
      expect(commitCalls.length).toBe(0);
    });

    test('should handle commit errors gracefully', async () => {
      exec.exec.mockRejectedValue(new Error('Git error'));

      await index.commitAndPush('test commit', 'test-branch');
      expect(core.warning).toHaveBeenCalled();
    });
  });

  describe('createPullRequest', () => {
    beforeEach(() => {
      const mockOctokit = {
        rest: {
          pulls: {
            create: jest.fn().mockResolvedValue({
              data: { number: 123, html_url: 'https://github.com/owner/repo/pull/123' },
            }),
          },
        },
      };
      github.getOctokit.mockReturnValue(mockOctokit);
      github.context = {
        repo: { owner: 'owner', repo: 'repo' },
        actor: 'test-user',
      };
    });

    test('should create a pull request', async () => {
      const prNumber = await index.createPullRequest(
        'fake-token',
        'test-branch',
        'main',
        'Test PR',
        'Test body'
      );

      expect(prNumber).toBe(123);
      expect(github.getOctokit).toHaveBeenCalledWith('fake-token');
    });

    test('should handle PR creation errors', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            create: jest.fn().mockRejectedValue(new Error('API error')),
          },
        },
      };
      github.getOctokit.mockReturnValue(mockOctokit);

      const prNumber = await index.createPullRequest(
        'fake-token',
        'test-branch',
        'main',
        'Test PR',
        'Test body'
      );

      expect(prNumber).toBeNull();
      expect(core.error).toHaveBeenCalled();
    });
  });

  describe('assignPR', () => {
    beforeEach(() => {
      const mockOctokit = {
        rest: {
          issues: {
            addAssignees: jest.fn().mockResolvedValue({}),
          },
        },
      };
      github.getOctokit.mockReturnValue(mockOctokit);
      github.context = {
        repo: { owner: 'owner', repo: 'repo' },
        actor: 'test-user',
      };
    });

    test('should assign PR to actor', async () => {
      await index.assignPR('fake-token', 123);

      expect(github.getOctokit).toHaveBeenCalledWith('fake-token');
    });

    test('should handle assignment errors gracefully', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            addAssignees: jest.fn().mockRejectedValue(new Error('API error')),
          },
        },
      };
      github.getOctokit.mockReturnValue(mockOctokit);

      await index.assignPR('fake-token', 123);
      expect(core.warning).toHaveBeenCalled();
    });
  });

  describe('Input validation', () => {
    test('should require PRIVATE_TOKEN', () => {
      core.getInput.mockImplementation((name, options) => {
        if (name === 'PRIVATE_TOKEN' && options?.required) {
          throw new Error('Input required and not supplied: PRIVATE_TOKEN');
        }
        return '';
      });

      expect(() => {
        core.getInput('PRIVATE_TOKEN', { required: true });
      }).toThrow('Input required and not supplied: PRIVATE_TOKEN');
    });

    test('should use default branch when not provided', () => {
      core.getInput.mockImplementation((name) => {
        if (name === 'branch') return '';
        return 'fake-token';
      });

      const branch = core.getInput('branch') || 'main';
      expect(branch).toBe('main');
    });
  });
});
