import { describe, test, expect, vi, beforeEach } from 'vitest';
import { LLMProvider } from '../src/providers/provider.js';
import { OpenAIProvider } from '../src/providers/openai.js';
import { AnthropicProvider } from '../src/providers/anthropic.js';
import { createProvider } from '../src/providers/index.js';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('LLM Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('LLMProvider base class', () => {
    test('cannot be instantiated directly', () => {
      expect(() => new LLMProvider({ apiKey: 'key', logger: mockLogger })).toThrow(
        'cannot be instantiated directly'
      );
    });

    test('requires apiKey', () => {
      class TestProvider extends LLMProvider {
        get defaultModel() {
          return 'test';
        }
        get name() {
          return 'test';
        }
      }
      expect(() => new TestProvider({ apiKey: '', logger: mockLogger })).toThrow(
        'apiKey is required'
      );
    });

    test('uses defaultModel when model not provided', () => {
      class TestProvider extends LLMProvider {
        get defaultModel() {
          return 'default-model';
        }
        get name() {
          return 'test';
        }
      }
      const provider = new TestProvider({ apiKey: 'key', logger: mockLogger });
      expect(provider.model).toBe('default-model');
    });

    test('uses provided model override', () => {
      class TestProvider extends LLMProvider {
        get defaultModel() {
          return 'default-model';
        }
        get name() {
          return 'test';
        }
      }
      const provider = new TestProvider({
        apiKey: 'key',
        model: 'custom-model',
        logger: mockLogger,
      });
      expect(provider.model).toBe('custom-model');
    });

    test('generate throws if not implemented', async () => {
      class TestProvider extends LLMProvider {
        get defaultModel() {
          return 'test';
        }
        get name() {
          return 'test';
        }
      }
      const provider = new TestProvider({ apiKey: 'key', logger: mockLogger });
      await expect(provider.generate({})).rejects.toThrow('must implement generate');
    });
  });

  describe('OpenAIProvider', () => {
    test('has correct defaults', () => {
      const p = new OpenAIProvider({ apiKey: 'sk-test', logger: mockLogger });
      expect(p.name).toBe('openai');
      expect(p.model).toBe('gpt-4o');
    });

    test('sends correct request to OpenAI API', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Generated code' } }],
          usage: { total_tokens: 100 },
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const p = new OpenAIProvider({ apiKey: 'sk-test', logger: mockLogger });
      const result = await p.generate({ instructions: 'Write code' });

      expect(result).toBe('Generated code');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test',
          }),
        })
      );

      vi.unstubAllGlobals();
    });

    test('includes file content in messages when provided', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Result' } }],
          usage: { total_tokens: 50 },
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const p = new OpenAIProvider({ apiKey: 'sk-test', logger: mockLogger });
      await p.generate({
        instructions: 'Fix this',
        fileContent: 'const x = 1;',
        fileName: 'index.js',
      });

      const callBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(callBody.messages).toHaveLength(3);
      expect(callBody.messages[1].content).toContain('index.js');
      expect(callBody.messages[1].content).toContain('const x = 1;');

      vi.unstubAllGlobals();
    });

    test('throws on API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: vi.fn().mockResolvedValue('Unauthorized'),
        })
      );

      const p = new OpenAIProvider({ apiKey: 'bad-key', logger: mockLogger });
      await expect(p.generate({ instructions: 'test' })).rejects.toThrow('OpenAI API error (401)');

      vi.unstubAllGlobals();
    });

    test('throws on empty response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ choices: [{ message: {} }] }),
        })
      );

      const p = new OpenAIProvider({ apiKey: 'sk-test', logger: mockLogger });
      await expect(p.generate({ instructions: 'test' })).rejects.toThrow('empty response');

      vi.unstubAllGlobals();
    });
  });

  describe('AnthropicProvider', () => {
    test('has correct defaults', () => {
      const p = new AnthropicProvider({ apiKey: 'ant-test', logger: mockLogger });
      expect(p.name).toBe('anthropic');
      expect(p.model).toBe('claude-sonnet-4-20250514');
    });

    test('sends correct request to Anthropic API', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ text: 'Generated code' }],
          usage: { input_tokens: 50, output_tokens: 50 },
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const p = new AnthropicProvider({ apiKey: 'ant-test', logger: mockLogger });
      const result = await p.generate({ instructions: 'Write code' });

      expect(result).toBe('Generated code');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'ant-test',
            'anthropic-version': '2023-06-01',
          }),
        })
      );

      vi.unstubAllGlobals();
    });

    test('throws on API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValue('Rate limited'),
        })
      );

      const p = new AnthropicProvider({ apiKey: 'ant-test', logger: mockLogger });
      await expect(p.generate({ instructions: 'test' })).rejects.toThrow(
        'Anthropic API error (429)'
      );

      vi.unstubAllGlobals();
    });

    test('throws on empty response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ content: [] }),
        })
      );

      const p = new AnthropicProvider({ apiKey: 'ant-test', logger: mockLogger });
      await expect(p.generate({ instructions: 'test' })).rejects.toThrow('empty response');

      vi.unstubAllGlobals();
    });
  });

  describe('createProvider factory', () => {
    test('creates OpenAI provider', () => {
      const p = createProvider({ provider: 'openai', apiKey: 'sk-test', logger: mockLogger });
      expect(p).toBeInstanceOf(OpenAIProvider);
      expect(p.name).toBe('openai');
    });

    test('creates Anthropic provider', () => {
      const p = createProvider({ provider: 'anthropic', apiKey: 'ant-test', logger: mockLogger });
      expect(p).toBeInstanceOf(AnthropicProvider);
      expect(p.name).toBe('anthropic');
    });

    test('normalizes provider name', () => {
      const p = createProvider({ provider: '  OpenAI  ', apiKey: 'sk-test', logger: mockLogger });
      expect(p).toBeInstanceOf(OpenAIProvider);
    });

    test('throws on missing provider name', () => {
      expect(() => createProvider({ provider: '', apiKey: 'key', logger: mockLogger })).toThrow(
        'LLM_PROVIDER is required'
      );
    });

    test('throws on unknown provider', () => {
      expect(() =>
        createProvider({ provider: 'unknown', apiKey: 'key', logger: mockLogger })
      ).toThrow('Unknown LLM provider');
    });

    test('passes model override', () => {
      const p = createProvider({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4-turbo',
        logger: mockLogger,
      });
      expect(p.model).toBe('gpt-4-turbo');
    });
  });
});
