/**
 * Context extraction utilities for Odel modules
 *
 * Handles extracting the ModuleContext from JSON-RPC request bodies
 * where mcp-proxy injects it.
 */

import { DEFAULT_MODULE_CONTEXT, ModuleContext, ToolContext } from './types.js';

/**
 * Shape of the JSON-RPC request body with context
 *
 * mcp-proxy injects context at the top level of the request body,
 * alongside the standard JSON-RPC fields.
 */
export interface RequestBodyWithContext {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: Record<string, unknown>;
    /** Module context injected by mcp-proxy */
    context?: Partial<ModuleContext>;
}

/**
 * Extract ModuleContext from a JSON-RPC request body
 *
 * If context is not provided (e.g., direct MCP client access),
 * returns default values for anonymous access.
 *
 * @param body - The JSON-RPC request body
 * @returns Complete ModuleContext with defaults applied
 *
 * @example
 * ```typescript
 * // In a tool handler that receives raw request
 * const context = extractContext(requestBody);
 * console.log(context.userId); // Either real hashed ID or 'anonymous'
 * ```
 */
export function extractContext(body: RequestBodyWithContext): ModuleContext {
    const ctx = body.context;

    if (!ctx) {
        return {
            ...DEFAULT_MODULE_CONTEXT,
            timestamp: Date.now(),
            requestId: crypto.randomUUID()
        };
    }

    return {
        userId: ctx.userId ?? DEFAULT_MODULE_CONTEXT.userId,
        conversationId: ctx.conversationId,
        displayName: ctx.displayName ?? DEFAULT_MODULE_CONTEXT.displayName,
        timestamp: ctx.timestamp ?? Date.now(),
        requestId: ctx.requestId ?? crypto.randomUUID(),
        secrets: ctx.secrets ?? {}
    };
}

/**
 * Create a ToolContext by combining ModuleContext with Worker env bindings
 *
 * @param moduleContext - The extracted module context
 * @param env - Cloudflare Worker environment bindings
 * @returns Complete ToolContext for handler use
 *
 * @example
 * ```typescript
 * const moduleContext = extractContext(body);
 * const toolContext = createToolContext(moduleContext, env);
 *
 * // Pass to handler
 * const result = await handler(input, toolContext);
 * ```
 */
export function createToolContext<Env>(moduleContext: ModuleContext, env: Env): ToolContext<Env> {
    return {
        ...moduleContext,
        env
    };
}

/**
 * Extract context and create ToolContext in one step
 *
 * Convenience function that combines extractContext and createToolContext.
 *
 * @param body - The JSON-RPC request body
 * @param env - Cloudflare Worker environment bindings
 * @returns Complete ToolContext for handler use
 *
 * @example
 * ```typescript
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const body = await request.json() as RequestBodyWithContext;
 *     const context = extractToolContext(body, env);
 *
 *     // Use context in handler
 *     console.log(context.userId, context.env.MY_KV);
 *   }
 * }
 * ```
 */
export function extractToolContext<Env>(body: RequestBodyWithContext, env: Env): ToolContext<Env> {
    return createToolContext(extractContext(body), env);
}

/**
 * Get a required secret from context, throwing ModuleError if missing
 *
 * @param context - The module or tool context
 * @param secretName - Name of the required secret
 * @returns The secret value
 * @throws ModuleError with MISSING_SECRET code if not found
 *
 * @example
 * ```typescript
 * import { getRequiredSecret } from '@anthropic/ts-module-sdk/odel';
 *
 * const apiKey = getRequiredSecret(context, 'OPENAI_API_KEY');
 * // Throws if not configured
 * ```
 */
export function getRequiredSecret(context: ModuleContext, secretName: string): string {
    const value = context.secrets[secretName];
    if (!value) {
        throw new Error(`Required secret "${secretName}" is not configured`);
    }
    return value;
}

/**
 * Get an optional secret from context
 *
 * @param context - The module or tool context
 * @param secretName - Name of the secret
 * @returns The secret value or undefined if not configured
 *
 * @example
 * ```typescript
 * const webhookUrl = getOptionalSecret(context, 'WEBHOOK_URL');
 * if (webhookUrl) {
 *   await notifyWebhook(webhookUrl, result);
 * }
 * ```
 */
export function getOptionalSecret(context: ModuleContext, secretName: string): string | undefined {
    return context.secrets[secretName];
}
