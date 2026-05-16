import { chatFlexDb, type McpToolStateRecord } from './chatflex-db';
import type { McpServerConfig, McpServerRecord } from '@/types/mcp';
import { v4 as uuid } from 'uuid';

/**
 * MCP 服务器配置与工具状态的数据库访问层
 */
class McpDatabase {
  /**
   * 将数据库记录转换为配置对象
   */
  private recordToConfig(record: McpServerRecord): McpServerConfig {
    let headers: Record<string, string> = {};
    try {
      headers = record.headers ? JSON.parse(record.headers) : {};
    } catch {
      headers = {};
    }

    return {
      id: record.id,
      name: record.name,
      description: record.description || undefined,
      url: record.url,
      headers,
      enabled: Boolean(record.enabled),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * 将配置对象转换为数据库记录
   */
  private configToRecord(config: McpServerConfig): McpServerRecord {
    return {
      id: config.id,
      name: config.name,
      description: config.description || '',
      url: config.url,
      headers: JSON.stringify(config.headers || {}),
      enabled: config.enabled,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * 获取所有 MCP 服务器配置
   */
  async getAllServers(): Promise<McpServerConfig[]> {
    const records = await chatFlexDb.mcpServers.toArray();
    return records.map((record) => this.recordToConfig(record));
  }

  /**
   * 获取已启用的 MCP 服务器配置
   */
  async getEnabledServers(): Promise<McpServerConfig[]> {
    const records = await chatFlexDb.mcpServers.filter((r) => Boolean(r.enabled)).toArray();
    return records.map((record) => this.recordToConfig(record));
  }

  /**
   * 根据 ID 获取 MCP 服务器配置
   */
  async getServerById(id: string): Promise<McpServerConfig | undefined> {
    const record = await chatFlexDb.mcpServers.get(id);
    return record ? this.recordToConfig(record) : undefined;
  }

  /**
   * 添加新的 MCP 服务器
   */
  async addServer(config: Omit<McpServerConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<McpServerConfig> {
    const now = Date.now();
    const newConfig: McpServerConfig = {
      ...config,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    };

    await chatFlexDb.mcpServers.add(this.configToRecord(newConfig));
    return newConfig;
  }

  /**
   * 更新 MCP 服务器配置
   */
  async updateServer(id: string, updates: Partial<Omit<McpServerConfig, 'id' | 'createdAt'>>): Promise<void> {
    const existing = await chatFlexDb.mcpServers.get(id);
    if (!existing) {
      throw new Error(`[McpDatabase] Server not found: ${id}`);
    }

    const updatedRecord: McpServerRecord = {
      ...existing,
      ...updates,
      headers: updates.headers !== undefined ? JSON.stringify(updates.headers) : existing.headers,
      updatedAt: Date.now(),
    };

    await chatFlexDb.mcpServers.put(updatedRecord);
  }

  /**
   * 删除 MCP 服务器
   */
  async deleteServer(id: string): Promise<void> {
    await chatFlexDb.mcpServers.delete(id);
  }

  /**
   * 设置服务器启用状态
   */
  async setServerEnabled(id: string, enabled: boolean): Promise<void> {
    await this.updateServer(id, { enabled });
  }

  /**
   * 获取会话的 MCP 工具启用状态
   */
  async getChatMcpToolState(chatId: string): Promise<string[]> {
    const record = await chatFlexDb.mcpToolStates.get(chatId);
    if (!record) {
      return [];
    }
    try {
      return JSON.parse(record.enabledTools);
    } catch {
      return [];
    }
  }

  /**
   * 设置会话的 MCP 工具启用状态
   */
  async setChatMcpToolState(chatId: string, enabledTools: string[]): Promise<void> {
    const record: McpToolStateRecord = {
      chatId,
      enabledTools: JSON.stringify(enabledTools),
      updatedAt: Date.now(),
    };
    await chatFlexDb.mcpToolStates.put(record);
  }

  /**
   * 清除会话的 MCP 工具启用状态
   */
  async clearChatMcpToolState(chatId: string): Promise<void> {
    await chatFlexDb.mcpToolStates.delete(chatId);
  }

  /**
   * 为会话添加一个 MCP 工具
   */
  async enableMcpToolForChat(chatId: string, toolId: string): Promise<void> {
    const currentTools = await this.getChatMcpToolState(chatId);
    if (!currentTools.includes(toolId)) {
      await this.setChatMcpToolState(chatId, [...currentTools, toolId]);
    }
  }

  /**
   * 为会话移除一个 MCP 工具
   */
  async disableMcpToolForChat(chatId: string, toolId: string): Promise<void> {
    const currentTools = await this.getChatMcpToolState(chatId);
    const newTools = currentTools.filter((t) => t !== toolId);
    await this.setChatMcpToolState(chatId, newTools);
  }
}

export const mcpDb = new McpDatabase();
