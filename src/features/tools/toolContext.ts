/**
 * Tool execution context
 * Provides chatId context to tool executions during AI inference
 */

let currentChatId: string | null = null;

export function setToolContext(chatId: string) {
  currentChatId = chatId;
}

export function getToolContext(): string | null {
  return currentChatId;
}

export function clearToolContext() {
  currentChatId = null;
}
