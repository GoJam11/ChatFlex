/**
 * MCP 客户端服务
 * 使用 Tauri HTTP 插件绕过 CORS 限制
 */

import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type {
  McpServerConfig,
  McpServerState,
  McpToolDefinition,
} from '@/types/mcp';
import { formatMcpToolId, toSafeToolId } from '@/types/mcp';
import { mcpDb } from '@/persistence/McpDatabase';
import { TauriMcpTransport } from './tauriMcpTransport';

interface ActiveConnection {
  transport: TauriMcpTransport;
  toolDefinitions: McpToolDefinition[];
  serverId: string;
}

/**
 * MCP 客户端服务 - 管理多个 MCP 服务器连接
 */
class McpClientService {
  private connections: Map<string, ActiveConnection> = new Map();
  private serverStates: Map<string, McpServerState> = new Map();
  private initialized = false;

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const servers = await mcpDb.getEnabledServers();
      for (const server of servers) {
        await this.connectServer(server);
      }
      this.initialized = true;
    } catch (error) {
      console.error('[McpClientService] 初始化失败:', error);
    }
  }

  /**
   * 连接到 MCP 服务器
   */
  async connectServer(config: McpServerConfig): Promise<boolean> {
    if (this.connections.has(config.id)) {
      return true;
    }

    this.updateServerState(config.id, {
      serverId: config.id,
      status: 'connecting',
      tools: [],
    });

    try {
      // 使用 Tauri HTTP 的自定义传输
      const transport = new TauriMcpTransport(config.url, config.headers || {});

      // 初始化连接
      await transport.initialize();

      // 获取工具列表
      const toolDefinitions = await transport.listTools();

      this.connections.set(config.id, {
        transport,
        toolDefinitions,
        serverId: config.id,
      });

      this.updateServerState(config.id, {
        serverId: config.id,
        status: 'connected',
        tools: toolDefinitions,
        lastConnectedAt: Date.now(),
      });

      console.log(`[McpClientService] 已连接到服务器 ${config.name}，可用工具: ${toolDefinitions.length}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '连接失败';
      console.error(`[McpClientService] 连接服务器 ${config.name} 失败:`, error);

      this.updateServerState(config.id, {
        serverId: config.id,
        status: 'error',
        tools: [],
        error: errorMessage,
      });

      return false;
    }
  }

  /**
   * 断开 MCP 服务器连接
   */
  async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    try {
      await connection.transport.close();
    } catch (error) {
      console.error(`[McpClientService] 断开服务器 ${serverId} 失败:`, error);
    }

    this.connections.delete(serverId);
    this.updateServerState(serverId, {
      serverId,
      status: 'disconnected',
      tools: [],
    });
  }

  /**
   * 重新连接服务器
   */
  async reconnectServer(serverId: string): Promise<boolean> {
    await this.disconnectServer(serverId);
    const config = await mcpDb.getServerById(serverId);
    if (!config) {
      return false;
    }
    return this.connectServer(config);
  }

  /**
   * 获取服务器状态
   */
  getServerState(serverId: string): McpServerState | undefined {
    return this.serverStates.get(serverId);
  }

  /**
   * 获取所有服务器状态
   */
  getAllServerStates(): McpServerState[] {
    return Array.from(this.serverStates.values());
  }

  /**
   * 检查服务器是否已连接
   */
  isServerConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  /**
   * 构建 AI SDK 兼容的工具集
   * 仅包含指定的 MCP 工具 ID
   */
  buildToolSet(enabledToolIds: string[]): Record<string, Tool> {
    const toolSet: Record<string, Tool> = {};

    for (const toolId of enabledToolIds) {
      const parts = toolId.split(':');
      if (parts.length < 3 || parts[0] !== 'mcp') {
        continue;
      }

      const serverId = parts[1];
      const toolName = parts.slice(2).join(':');
      const connection = this.connections.get(serverId);

      if (!connection) {
        console.warn(`[McpClientService] 服务器 ${serverId} 未连接，跳过工具 ${toolName}`);
        continue;
      }

      const toolDef = connection.toolDefinitions.find((t) => t.name === toolName);
      if (!toolDef) {
        console.warn(`[McpClientService] 工具 ${toolName} 在服务器 ${serverId} 中未找到`);
        continue;
      }

      // 保存引用以便在闭包中使用
      const transport = connection.transport;
      const currentToolName = toolName;

      // 将 JSON Schema 转换为 Zod schema
      const zodSchema = this.jsonSchemaToZod(toolDef.inputSchema);

      // 将工具 ID 转换为 AI 安全格式（下划线代替冒号）
      // 大多数 AI 供应商只允许工具名称包含 [a-zA-Z0-9_-]
      const safeToolId = toSafeToolId(toolId);
      toolSet[safeToolId] = tool({
        description: toolDef.description || `MCP tool: ${toolName}`,
        inputSchema: zodSchema,
        execute: async (args: Record<string, unknown>) => {
          try {
            return await transport.callTool(currentToolName, args);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '工具执行失败';
            return `工具执行失败: ${errorMessage}`;
          }
        },
      });
    }

    return toolSet;
  }

  /**
   * 将 JSON Schema 转换为 Zod schema
   */
  private jsonSchemaToZod(schema?: McpToolDefinition['inputSchema']): z.ZodObject<Record<string, z.ZodTypeAny>> {
    if (!schema || !schema.properties) {
      return z.object({});
    }

    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(schema.properties)) {
      const propSchema = prop as { type?: string; description?: string };
      let zodType: z.ZodTypeAny;

      switch (propSchema.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
        case 'integer':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.unknown());
          break;
        case 'object':
          zodType = z.record(z.string(), z.unknown());
          break;
        default:
          zodType = z.unknown();
      }

      const isRequired = schema.required?.includes(key);
      shape[key] = isRequired ? zodType : zodType.optional();
    }

    return z.object(shape);
  }

  /**
   * 更新服务器状态
   */
  private updateServerState(serverId: string, state: McpServerState): void {
    this.serverStates.set(serverId, state);
  }

  /**
   * 关闭所有连接
   */
  async shutdown(): Promise<void> {
    for (const serverId of this.connections.keys()) {
      await this.disconnectServer(serverId);
    }
    this.initialized = false;
  }

  /**
   * 刷新所有已启用服务器的连接
   */
  async refreshConnections(): Promise<void> {
    // 先断开所有连接
    for (const serverId of this.connections.keys()) {
      await this.disconnectServer(serverId);
    }

    // 重新连接所有已启用的服务器
    const servers = await mcpDb.getEnabledServers();
    for (const server of servers) {
      await this.connectServer(server);
    }
  }
}

// 单例导出
export const mcpClientService = new McpClientService();

/**
 * 获取所有可用的 MCP 工具列表 (用于 UI 展示)
 */
export async function getAvailableMcpTools(): Promise<
  Array<{
    id: string;
    serverId: string;
    serverName: string;
    toolName: string;
    description: string;
  }>
> {
  await mcpClientService.initialize();

  const servers = await mcpDb.getEnabledServers();
  const result: Array<{
    id: string;
    serverId: string;
    serverName: string;
    toolName: string;
    description: string;
  }> = [];

  for (const server of servers) {
    const state = mcpClientService.getServerState(server.id);
    if (!state || state.status !== 'connected') {
      continue;
    }

    for (const tool of state.tools) {
      result.push({
        id: formatMcpToolId(server.id, tool.name),
        serverId: server.id,
        serverName: server.name,
        toolName: tool.name,
        description: tool.description || '',
      });
    }
  }

  return result;
}
