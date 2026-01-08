# LLM Provider System

This system allows switching between different LLM providers using environment variables. Currently supported providers:

- Claude (Anthropic) - Default
- Gemini (Google)
- Groq
- OpenAI

## Configuration

Set the following environment variables to configure the LLM system:

```bash
# Required: Choose the LLM provider
LLM_PROVIDER=claude|gemini|groq|openai

# Required: API keys for the providers you want to use
CLAUDE_API_KEY=your_claude_api_key
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
OPENAI_API_KEY=your_openai_api_key
```

If `LLM_PROVIDER` is not set, the system defaults to using Claude.

## Models Used

Each provider is configured to use a capable model suitable for generating web content:

- Claude: claude-sonnet-4-20250514
- Gemini: gemini-pro
- Groq: mixtral-8x7b-32768
- OpenAI: gpt-4-turbo-preview

## Usage

The system uses a factory pattern to create the appropriate provider instance. You don't need to interact with the providers directly - just use the factory:

```typescript
import { getLLMProvider } from "@makemy/llms/factory.ts";

const llmProvider = getLLMProvider();
const response = await llmProvider.generate("Your prompt here");
```

## Adding New Providers

To add a new provider:

1. Create a new file in the `llms` directory (e.g., `newprovider.ts`)
2. Implement the `LLMProvider` interface
3. Add the provider to the `SupportedLLMProvider` type in `base.ts`
4. Add the provider to the factory in `factory.ts`
