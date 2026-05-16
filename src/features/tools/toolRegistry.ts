import type { Tool, ToolSet } from 'ai';
import { fetchWebTool, FETCH_WEB_TOOL_ID } from './fetchWebTool';
import {
  knowledgeBaseListTool,
  knowledgeBaseReadTool,
  knowledgeBaseSearchTool,
  KNOWLEDGE_BASE_LIST_TOOL_ID,
  KNOWLEDGE_BASE_READ_TOOL_ID,
  KNOWLEDGE_BASE_SEARCH_TOOL_ID,
} from './knowledgeBaseTool';
import {
  chatHistorySearchTool,
  chatHistoryGetMessagesTool,
  chatHistoryListChatsTool,
  CHAT_HISTORY_SEARCH_TOOL_ID,
  CHAT_HISTORY_GET_MESSAGES_TOOL_ID,
  CHAT_HISTORY_LIST_CHATS_TOOL_ID,
} from './chatHistoryTool';
import { isMcpToolId } from '@/types/mcp';
import { mcpClientService } from '@/features/mcp/mcpClientService';

const registry: Record<string, Tool> = {
  [FETCH_WEB_TOOL_ID]: fetchWebTool,
  [KNOWLEDGE_BASE_LIST_TOOL_ID]: knowledgeBaseListTool,
  [KNOWLEDGE_BASE_READ_TOOL_ID]: knowledgeBaseReadTool,
  [KNOWLEDGE_BASE_SEARCH_TOOL_ID]: knowledgeBaseSearchTool,
  [CHAT_HISTORY_SEARCH_TOOL_ID]: chatHistorySearchTool,
  [CHAT_HISTORY_GET_MESSAGES_TOOL_ID]: chatHistoryGetMessagesTool,
  [CHAT_HISTORY_LIST_CHATS_TOOL_ID]: chatHistoryListChatsTool,
};

export const TOOL_IDS = Object.freeze(Object.keys(registry));

/**
 * 构建工具集 (仅内置工具)
 */
export function buildToolSet(ids: readonly string[]): ToolSet | undefined {
  const toolSet: Record<string, Tool> = {};

  ids.forEach((id) => {
    const tool = registry[id];
    if (tool) {
      toolSet[id] = tool;
    }
  });

  if (Object.keys(toolSet).length === 0) {
    return undefined;
  }

  return toolSet as ToolSet;
}

/**
 * 构建包含 MCP 工具的完整工具集
 */
export function buildToolSetWithMcp(
  builtinIds: readonly string[],
  mcpToolIds: readonly string[]
): ToolSet | undefined {
  const toolSet: Record<string, Tool> = {};

  // 添加内置工具
  builtinIds.forEach((id) => {
    const tool = registry[id];
    if (tool) {
      toolSet[id] = tool;
    }
  });

  // 添加 MCP 工具
  if (mcpToolIds.length > 0) {
    const mcpTools = mcpClientService.buildToolSet(mcpToolIds as string[]);
    Object.assign(toolSet, mcpTools);
  }

  if (Object.keys(toolSet).length === 0) {
    return undefined;
  }

  return toolSet as ToolSet;
}

export function getToolById(id: string): Tool | undefined {
  return registry[id];
}

/**
 * 判断工具 ID 是否为 MCP 工具
 */
export { isMcpToolId };
