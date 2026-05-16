# ChatFlex

![ChatFlex product screenshot](./assets/product.png)

ChatFlex is a local-first desktop AI chat client built with Tauri 2, Vue 3, TypeScript, and the Vercel AI SDK.

English | [简体中文](./README.md)

## Features

- Multi-provider AI chat: OpenAI, Anthropic, Google, DeepSeek, Ollama, OpenRouter, Groq, Together, and custom OpenAI-compatible endpoints.
- Local IndexedDB persistence for chats, messages, providers, models, prompts, and tool settings.
- Streaming responses, markdown rendering, image display, prompt management, memory, and data export.
- Desktop integrations through Tauri plugins for file access, dialogs, shortcuts, opener, logging, HTTP, and optional updater support.

## Development

```bash
bun install
bun run dev
```

For the desktop shell:

```bash
bun run tauri:dev
```

## Build

```bash
bun run build
bun run tauri:build
```

## Tests

```bash
bun run test
```

Ollama integration tests are skipped by default. To run them locally:

```bash
RUN_OLLAMA_INTEGRATION=true OLLAMA_TEST_MODEL=gpt-oss:latest bun run test
```

## Configuration

Copy `.env.example` to `.env` only when you need to enable optional development flags. No API keys or service credentials are required in the repository.

Auto-update is disabled by default in this public version. Configure your own updater endpoint and signing key before enabling it.

## License

MIT
