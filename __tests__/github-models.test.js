import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createGitHubModelsClient } from '../src/github-models.js';

// Avoid global fetch collision — use vi.stubGlobal
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('GitHub Models Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGitHubModelsClient', () => {
    test('throws without token', () => {
      expect(() => createGitHubModelsClient({ token: '', logger: mockLogger })).toThrow(
        'GITHUB_TOKEN is required'
      );
    });

    test('creates client with default model', () => {
      const client = createGitHubModelsClient({ token: 'ghp_test', logger: mockLogger });
      expect(client.name).toBe('github-models');
      expect(client.model).toBe('gpt-4o');
      expect(client.generate).toBeTypeOf('function');
    });

    test('creates client with custom model', () => {
      const client = createGitHubModelsClient({
        token: 'ghp_test',
        model: 'o3-mini',
        logger: mockLogger,
      });
      expect(client.model).toBe('o3-mini');
    });
  });

  describe('generate', () => {
    test('sends correct request to GitHub Models API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Generated code here' } }],
        }),
      });

      const client = createGitHubModelsClient({ token: 'ghp_test', logger: mockLogger });
      const result = await client.generate({ instructions: 'Write a hello world function' });

      expect(result).toBe('Generated code here');
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://models.inference.ai.azure.com/chat/completions');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer ghp_test');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('gpt-4o');
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toBe('Write a hello world function');
    });

    test('includes file content as context when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Updated code' } }],
        }),
      });

      const client = createGitHubModelsClient({ token: 'ghp_test', logger: mockLogger });
      await client.generate({
        instructions: 'Fix the bug',
        fileContent: 'const x = 1;',
        fileName: 'app.js',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(3);
      expect(body.messages[1].content).toContain('app.js');
      expect(body.messages[1].content).toContain('const x = 1;');
    });

    test('handles file content without filename', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'result' } }],
        }),
      });

      const client = createGitHubModelsClient({ token: 'ghp_test', logger: mockLogger });
      await client.generate({
        instructions: 'Review',
        fileContent: 'some code',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[1].content).toContain('unknown');
    });

    test('throws on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden: models:read permission required',
      });

      const client = createGitHubModelsClient({ token: 'ghp_test', logger: mockLogger });
      await expect(client.generate({ instructions: 'test' })).rejects.toThrow(
        'GitHub Models API error (403)'
      );
    });

    test('throws on empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '' } }] }),
      });

      const client = createGitHubModelsClient({ token: 'ghp_test', logger: mockLogger });
      await expect(client.generate({ instructions: 'test' })).rejects.toThrow(
        'GitHub Models API returned empty response'
      );
    });

    test('throws on malformed response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      });

      const client = createGitHubModelsClient({ token: 'ghp_test', logger: mockLogger });
      await expect(client.generate({ instructions: 'test' })).rejects.toThrow(
        'GitHub Models API returned empty response'
      );
    });

    test('uses custom model in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'response' } }],
        }),
      });

      const client = createGitHubModelsClient({
        token: 'ghp_test',
        model: 'o3-mini',
        logger: mockLogger,
      });
      await client.generate({ instructions: 'test' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.model).toBe('o3-mini');
    });
  });
});
