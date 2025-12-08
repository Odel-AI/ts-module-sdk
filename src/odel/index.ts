/**
 * Odel Module SDK Extensions
 *
 * This module provides Odel-specific types and utilities for building
 * modules on the Odel platform, extending the base MCP SDK.
 *
 * @packageDocumentation
 */

// Types
export { DEFAULT_MODULE_CONTEXT } from './types.js';
export type { ModuleContext, ToolContext } from './types.js';

// Error handling
export { ErrorCode, ModuleError } from './errors.js';

// Validators
export { validators } from './validators.js';

// Schema helpers
export { SimpleSuccessSchema, SuccessResponseSchema } from './schemas.js';
export type { ErrorResponse, SuccessResponse } from './schemas.js';

// Context utilities
export {
	createToolContext,
	extractContext,
	extractToolContext,
	getOptionalSecret,
	getRequiredSecret,
} from './context.js';
export type { RequestBodyWithContext } from './context.js';
