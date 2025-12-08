# Odel Module SDK ![NPM Version](https://img.shields.io/npm/v/%40odel%2Fmodule-sdk) ![MIT licensed](https://img.shields.io/npm/l/%40odel%2Fmodule-sdk)

> **Fork of the [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)** with Odel-specific extensions for the Odel Platform

SDK for building Odel modules - full MCP protocol implementation with additional utilities for context management, error handling, and input validation.

<details>
<summary>Table of Contents</summary>

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Odel Extensions](#odel-extensions)
  - [Context](#context)
  - [Error Handling](#error-handling)
  - [Validators](#validators)
  - [Response Schemas](#response-schemas)
- [MCP Core Concepts](#mcp-core-concepts)
- [Documentation](#documentation)
- [License](#license)

</details>

## Overview

This SDK provides:

- Full MCP protocol implementation (tools, resources, prompts)
- Odel context management (user info, secrets, request tracking)
- Standardized error handling with error codes
- Common validators for inputs (email, URL, API keys, etc.)
- Response schema helpers for consistent API responses

## Installation

```bash
npm install @odel/module-sdk zod
```

This SDK has a **required peer dependency** on `zod` for schema validation.

## Quick Start

```typescript
import { McpServer } from '@odel/module-sdk/server';
import { z } from 'zod';
import {
  extractToolContext,
  getRequiredSecret,
  ModuleError,
  SuccessResponseSchema,
  validators,
} from '@odel/module-sdk/odel';

// Define your response schema
const SendEmailResponseSchema = SuccessResponseSchema(
  z.object({
    messageId: z.string(),
    sentAt: z.string(),
  })
);

// Create your MCP server
const server = new McpServer({
  name: 'email-module',
  version: '1.0.0',
});

// Register a tool
server.tool(
  'send-email',
  'Send an email',
  {
    to: validators.email(),
    subject: validators.nonEmptyString(),
    body: z.string(),
  },
  async (args, extra) => {
    // Extract Odel context (userId, secrets, etc.)
    const ctx = extractToolContext(extra.requestBody, process.env);

    // Get required secrets
    const apiKey = getRequiredSecret(ctx, 'RESEND_API_KEY');

    try {
      // Your implementation here
      const result = await sendEmail(apiKey, args);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              messageId: result.id,
              sentAt: new Date().toISOString(),
            }),
          },
        ],
      };
    } catch (error) {
      throw ModuleError.apiError('Failed to send email', {
        originalError: error.message,
      });
    }
  }
);
```

## Odel Extensions

All Odel-specific utilities are available from `@odel/module-sdk/odel`:

```typescript
import {
  // Context
  extractContext,
  createToolContext,
  extractToolContext,
  getRequiredSecret,
  getOptionalSecret,
  DEFAULT_MODULE_CONTEXT,

  // Types
  type ModuleContext,
  type ToolContext,
  type RequestBodyWithContext,

  // Errors
  ModuleError,
  ErrorCode,

  // Validators
  validators,

  // Schemas
  SuccessResponseSchema,
  SimpleSuccessSchema,
  type SuccessResponse,
  type ErrorResponse,
} from '@odel/module-sdk/odel';
```

### Context

The Odel platform injects context into every module request, including user information and decrypted secrets.

#### ModuleContext

```typescript
interface ModuleContext {
  userId: string; // Hashed user ID (privacy-preserving)
  conversationId?: string; // Optional conversation ID
  displayName?: string; // User's display name
  timestamp: number; // Request timestamp
  requestId: string; // Unique request identifier
  secrets: Record<string, string>; // Decrypted user secrets
}
```

#### ToolContext

For Cloudflare Workers, `ToolContext<Env>` extends `ModuleContext` with typed environment bindings:

```typescript
interface ToolContext<Env> extends ModuleContext {
  env: Env; // Cloudflare Worker bindings
}
```

#### Context Functions

```typescript
// Extract context from JSON-RPC request body
const moduleContext = extractContext(requestBody);

// Create tool context with env bindings
const toolContext = createToolContext(moduleContext, env);

// Or do both in one step
const toolContext = extractToolContext(requestBody, env);

// Access secrets safely
const apiKey = getRequiredSecret(ctx, 'API_KEY'); // Throws if missing
const webhook = getOptionalSecret(ctx, 'WEBHOOK_URL'); // Returns undefined if missing
```

### Error Handling

Standardized error codes and a `ModuleError` class for consistent error responses.

#### Error Codes

| Range | Category   | Codes                                                                   |
| ----- | ---------- | ----------------------------------------------------------------------- |
| 1xxx  | Validation | `INVALID_INPUT`, `MISSING_REQUIRED_FIELD`, `INVALID_FORMAT`             |
| 2xxx  | Auth       | `MISSING_SECRET`, `INVALID_SECRET`, `UNAUTHORIZED`                      |
| 3xxx  | API        | `API_ERROR`, `NETWORK_ERROR`, `TIMEOUT`, `NOT_FOUND`                    |
| 4xxx  | Rate Limit | `RATE_LIMIT_EXCEEDED`, `QUOTA_EXCEEDED`                                 |
| 5xxx  | Internal   | `INTERNAL_ERROR`, `NOT_IMPLEMENTED`, `CONFIGURATION_ERROR`              |

#### Factory Methods

```typescript
// Validation errors
ModuleError.validationError('Invalid email format', { field: 'email' });
ModuleError.missingField('subject');

// Auth errors
ModuleError.missingSecret('RESEND_API_KEY');
ModuleError.invalidSecret('API_KEY', 'must start with sk-');

// API errors
ModuleError.apiError('Service unavailable', { statusCode: 503 });
ModuleError.networkError('Connection refused');
ModuleError.timeout('API call', 30000);
ModuleError.notFound('User', 'user_123');

// Rate limiting
ModuleError.rateLimitError(60); // retryAfter in seconds
ModuleError.quotaExceeded('API calls');

// Internal
ModuleError.internalError('Unexpected state');
ModuleError.notImplemented('bulk export');
ModuleError.configurationError('Missing database binding');
```

#### JSON Serialization

```typescript
const error = ModuleError.apiError('Service unavailable', { statusCode: 503 });
console.log(error.toJSON());
// {
//   success: false,
//   error: 'Service unavailable',
//   code: 3001,
//   metadata: { statusCode: 503 }
// }
```

### Validators

Pre-built Zod schemas for common input validation:

```typescript
import { validators } from '@odel/module-sdk/odel';
import { z } from 'zod';

const inputSchema = z.object({
  // Email validation
  email: validators.email(),
  recipients: validators.emailList(), // Array or comma-separated string

  // URL validation
  website: validators.url(), // http or https
  webhook: validators.httpsUrl(), // https only

  // API keys
  apiKey: validators.apiKey(), // Min 10 chars
  openaiKey: validators.apiKey('sk-'), // With prefix

  // Strings
  name: validators.nonEmptyString(),
  bio: validators.trimmedString(), // Auto-trims, rejects empty
  title: validators.boundedString(1, 100), // Length constraints
  nickname: validators.optionalString(), // Empty string → undefined

  // Numbers
  count: validators.positiveInt(), // > 0, integer
  offset: validators.nonNegativeInt(), // >= 0, integer
  port: validators.port(), // 1-65535

  // Other
  id: validators.uuid(),
  createdAt: validators.isoDate(), // ISO 8601 datetime
  status: validators.enumFrom(['draft', 'published', 'archived'] as const),
  config: validators.json<{ enabled: boolean }>(), // Parse JSON string
});
```

### Response Schemas

Standardized success/error response pattern:

```typescript
import { SuccessResponseSchema, SimpleSuccessSchema } from '@odel/module-sdk/odel';
import { z } from 'zod';

// Define a response schema with data fields
const EmailResponseSchema = SuccessResponseSchema(
  z.object({
    messageId: z.string(),
    sentAt: z.string(),
  })
);

// Type inference
type EmailResponse = z.infer<typeof EmailResponseSchema>;
// = { success: true; messageId: string; sentAt: string }
// | { success: false; error: string }

// Usage with type narrowing
function handleResponse(response: EmailResponse) {
  if (response.success) {
    console.log(`Sent: ${response.messageId}`);
  } else {
    console.error(`Failed: ${response.error}`);
  }
}

// Simple success/error without data
const result = SimpleSuccessSchema.parse({ success: true });
```

## MCP Core Concepts

This SDK includes the full MCP TypeScript SDK. Key concepts:

### Servers and Transports

- **Streamable HTTP** for remote servers (recommended)
- **HTTP + SSE** for backwards compatibility
- **stdio** for local integrations

### Tools, Resources, Prompts

- **Tools**: Let LLMs take actions (computation, API calls, side effects)
- **Resources**: Expose read-only data to clients
- **Prompts**: Reusable templates for consistent model interactions

### Capabilities

- **Sampling**: Server tools can request LLM completions from clients
- **Elicitation**: Request structured input via forms or secure browser flows
- **Tasks**: Long-running operations with polling/resumption

For detailed MCP documentation, see:

- [docs/server.md](docs/server.md) - Building MCP servers
- [docs/client.md](docs/client.md) - Using the MCP client
- [docs/capabilities.md](docs/capabilities.md) - Advanced capabilities

## Documentation

- [Model Context Protocol documentation](https://modelcontextprotocol.io)
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [Odel Developer Portal](https://dev.odel.app)

## License

This project is licensed under the MIT License—see the [LICENSE](LICENSE) file for details.

Based on the [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk).
