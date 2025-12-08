import { describe, test, expect } from 'vitest';
import {
	extractContext,
	createToolContext,
	extractToolContext,
	getRequiredSecret,
	getOptionalSecret,
	RequestBodyWithContext,
} from '../../src/odel/context.js';
import { DEFAULT_MODULE_CONTEXT } from '../../src/odel/types.js';

describe('Odel Context', () => {
	describe('extractContext', () => {
		test('should extract full context from request body', () => {
			const body: RequestBodyWithContext = {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				params: { name: 'test', arguments: {} },
				context: {
					userId: 'user_abc123',
					conversationId: 'conv_xyz789',
					displayName: 'Test User',
					timestamp: 1704067200000,
					requestId: 'req_123',
					secrets: {
						API_KEY: 'sk-test-key',
						WEBHOOK_URL: 'https://example.com/webhook',
					},
				},
			};

			const context = extractContext(body);

			expect(context.userId).toBe('user_abc123');
			expect(context.conversationId).toBe('conv_xyz789');
			expect(context.displayName).toBe('Test User');
			expect(context.timestamp).toBe(1704067200000);
			expect(context.requestId).toBe('req_123');
			expect(context.secrets).toEqual({
				API_KEY: 'sk-test-key',
				WEBHOOK_URL: 'https://example.com/webhook',
			});
		});

		test('should use defaults when context is missing', () => {
			const body: RequestBodyWithContext = {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				params: { name: 'test', arguments: {} },
			};

			const context = extractContext(body);

			expect(context.userId).toBe(DEFAULT_MODULE_CONTEXT.userId);
			expect(context.displayName).toBe(DEFAULT_MODULE_CONTEXT.displayName);
			expect(context.secrets).toEqual({});
			expect(context.requestId).toBeDefined();
			expect(context.timestamp).toBeGreaterThan(0);
		});

		test('should use defaults for missing fields in partial context', () => {
			const body: RequestBodyWithContext = {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				context: {
					userId: 'user_partial',
					// Missing other fields
				},
			};

			const context = extractContext(body);

			expect(context.userId).toBe('user_partial');
			expect(context.displayName).toBe(DEFAULT_MODULE_CONTEXT.displayName);
			expect(context.conversationId).toBeUndefined();
			expect(context.secrets).toEqual({});
		});

		test('should handle empty secrets object', () => {
			const body: RequestBodyWithContext = {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				context: {
					userId: 'user_123',
					secrets: {},
				},
			};

			const context = extractContext(body);

			expect(context.secrets).toEqual({});
		});
	});

	describe('createToolContext', () => {
		test('should combine ModuleContext with env bindings', () => {
			const moduleContext = {
				userId: 'user_123',
				displayName: 'Test User',
				timestamp: Date.now(),
				requestId: 'req_123',
				secrets: { API_KEY: 'test-key' },
			};

			interface TestEnv {
				MY_KV: { get: (key: string) => Promise<string | null> };
				API_SECRET: string;
			}

			const env: TestEnv = {
				MY_KV: { get: async () => 'value' },
				API_SECRET: 'secret-value',
			};

			const toolContext = createToolContext(moduleContext, env);

			expect(toolContext.userId).toBe('user_123');
			expect(toolContext.secrets.API_KEY).toBe('test-key');
			expect(toolContext.env).toBe(env);
			expect(toolContext.env.API_SECRET).toBe('secret-value');
		});
	});

	describe('extractToolContext', () => {
		test('should extract context and add env in one step', () => {
			const body: RequestBodyWithContext = {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				context: {
					userId: 'user_abc',
					secrets: { KEY: 'value' },
				},
			};

			const env = { BINDING: 'test' };

			const toolContext = extractToolContext(body, env);

			expect(toolContext.userId).toBe('user_abc');
			expect(toolContext.secrets.KEY).toBe('value');
			expect(toolContext.env.BINDING).toBe('test');
		});
	});

	describe('getRequiredSecret', () => {
		test('should return secret when it exists', () => {
			const context = {
				userId: 'user_123',
				timestamp: Date.now(),
				requestId: 'req_123',
				secrets: {
					API_KEY: 'sk-test-key',
					OTHER_SECRET: 'other-value',
				},
			};

			const apiKey = getRequiredSecret(context, 'API_KEY');

			expect(apiKey).toBe('sk-test-key');
		});

		test('should throw error when secret is missing', () => {
			const context = {
				userId: 'user_123',
				timestamp: Date.now(),
				requestId: 'req_123',
				secrets: {},
			};

			expect(() => getRequiredSecret(context, 'MISSING_KEY')).toThrow('Required secret "MISSING_KEY" is not configured');
		});

		test('should throw error when secret is empty string', () => {
			const context = {
				userId: 'user_123',
				timestamp: Date.now(),
				requestId: 'req_123',
				secrets: { EMPTY_KEY: '' },
			};

			expect(() => getRequiredSecret(context, 'EMPTY_KEY')).toThrow('Required secret "EMPTY_KEY" is not configured');
		});
	});

	describe('getOptionalSecret', () => {
		test('should return secret when it exists', () => {
			const context = {
				userId: 'user_123',
				timestamp: Date.now(),
				requestId: 'req_123',
				secrets: { OPTIONAL_KEY: 'optional-value' },
			};

			const value = getOptionalSecret(context, 'OPTIONAL_KEY');

			expect(value).toBe('optional-value');
		});

		test('should return undefined when secret is missing', () => {
			const context = {
				userId: 'user_123',
				timestamp: Date.now(),
				requestId: 'req_123',
				secrets: {},
			};

			const value = getOptionalSecret(context, 'MISSING_KEY');

			expect(value).toBeUndefined();
		});
	});
});
