/**
 * MCP (Model Context Protocol) 相关类型定义
 * 支持 HTTP Streamable MCP 服务器配置和工具管理
 */

/**
 * MCP 服务器配置
 */
export interface McpServerConfig {
  /** 服务器唯一标识符 */
  id: string;
  /** 服务器显示名称 */
  name: string;
  /** 服务器描述 */
  description?: string;
  /** HTTP URL 地址 */
  url: string;
  /** 自定义请求头 (如 Authorization) */
  headers?: Record<string, string>;
  /** 是否启用该服务器 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * MCP 服务器数据库记录
 */
export interface McpServerRecord {
  id: string;
  name: string;
  description: string;
  url: string;
  /** JSON 序列化的 headers */
  headers: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * MCP 工具定义 (从服务器获取)
 */
export interface McpToolDefinition {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description?: string;
  /** JSON Schema 格式的输入参数定义 */
  inputSchema?: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP 工具调用参数
 */
export interface McpToolCallParams {
  /** 服务器 ID */
  serverId: string;
  /** 工具名称 */
  toolName: string;
  /** 工具参数 */
  arguments: Record<string, unknown>;
}

/**
 * MCP 工具调用结果
 */
export interface McpToolCallResult {
  /** 是否成功 */
  success: boolean;
  /** 结果内容 */
  content?: unknown;
  /** 错误信息 */
  error?: string;
}

/**
 * MCP 服务器连接状态
 */
export type McpConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MCP 服务器运行时状态
 */
export interface McpServerState {
  /** 服务器 ID */
  serverId: string;
  /** 连接状态 */
  status: McpConnectionStatus;
  /** 可用工具列表 */
  tools: McpToolDefinition[];
  /** 错误信息 */
  error?: string;
  /** 最后连接时间 */
  lastConnectedAt?: number;
}

/**
 * 会话级别的 MCP 工具启用状态
 */
export interface ChatMcpToolState {
  /** 会话 ID */
  chatId: string;
  /** 已启用的 MCP 工具 (格式: serverId:toolName) */
  enabledTools: string[];
}

/**
 * MCP 工具 ID 格式化工具函数
 */
export const formatMcpToolId = (serverId: string, toolName: string): string => {
  return `mcp:${serverId}:${toolName}`;
};

/**
 * 解析 MCP 工具 ID
 */
export const parseMcpToolId = (toolId: string): { serverId: string; toolName: string } | null => {
  if (!toolId.startsWith('mcp:')) {
    return null;
  }
  const parts = toolId.slice(4).split(':');
  if (parts.length < 2) {
    return null;
  }
  const serverId = parts[0];
  const toolName = parts.slice(1).join(':');
  return { serverId, toolName };
};

/**
 * 判断是否为 MCP 工具 ID
 */
export const isMcpToolId = (toolId: string): boolean => {
  return toolId.startsWith('mcp:') || toolId.startsWith('mcp_');
};

/**
 * 将 AI 返回的安全工具 ID (下划线格式) 转换回内部格式 (冒号格式)
 * mcp_serverId_toolName -> mcp:serverId:toolName
 */
export const fromSafeToolId = (safeToolId: string): string => {
  if (safeToolId.startsWith('mcp_')) {
    // mcp_serverId_toolName -> mcp:serverId:toolName
    // 注意：只替换前两个下划线，toolName 中可能包含下划线
    const parts = safeToolId.split('_');
    if (parts.length >= 3) {
      const prefix = parts[0]; // 'mcp'
      const serverId = parts[1];
      const toolName = parts.slice(2).join('_');
      return `${prefix}:${serverId}:${toolName}`;
    }
  }
  return safeToolId;
};

/**
 * 将内部工具 ID (冒号格式) 转换为 AI 安全格式 (下划线格式)
 * mcp:serverId:toolName -> mcp_serverId_toolName
 */
export const toSafeToolId = (toolId: string): string => {
  return toolId.replace(/:/g, '_');
};
