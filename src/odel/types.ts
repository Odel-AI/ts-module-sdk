/**
 * Type definitions for Odel modules
 *
 * These types define the context object passed to module handlers,
 * containing user info, secrets, and Cloudflare Worker bindings.
 */

/**
 * Context provided to module handlers - basic user/request info
 *
 * This context is injected by mcp-proxy into the JSON-RPC body
 * and extracted by the module SDK before passing to handlers.
 */
export interface ModuleContext {
	/** Hashed user ID (privacy-preserving, consistent per user) */
	userId: string;
	/** Hashed conversation ID (optional, for multi-turn context) */
	conversationId?: string;
	/** User's display name */
	displayName?: string;
	/** Unix timestamp in milliseconds when request was made */
	timestamp: number;
	/** UUID for request tracing and logging */
	requestId: string;
	/** Decrypted user secrets configured for this module */
	secrets: Record<string, string>;
}

/**
 * Extended context with Cloudflare Worker environment bindings
 *
 * @typeParam Env - Worker bindings type (KV, D1, R2, secrets, etc.)
 *
 * @example
 * ```typescript
 * interface MyEnv {
 *   ANALYTICS: AnalyticsEngine;
 *   MY_KV: KVNamespace;
 * }
 *
 * const handler = async (input: Input, ctx: ToolContext<MyEnv>) => {
 *   // Access user context
 *   console.log(ctx.userId, ctx.secrets.API_KEY);
 *
 *   // Access typed Worker bindings
 *   await ctx.env.MY_KV.put('key', 'value');
 * };
 * ```
 */
export interface ToolContext<Env = unknown> extends ModuleContext {
	/** Cloudflare Worker environment bindings */
	env: Env;
}

/**
 * Default context values used when context is not provided
 * (primarily for testing or direct MCP client access)
 */
export const DEFAULT_MODULE_CONTEXT: ModuleContext = {
	userId: 'anonymous',
	displayName: 'Anonymous User',
	timestamp: Date.now(),
	requestId: 'no-request-id',
	secrets: {},
};
