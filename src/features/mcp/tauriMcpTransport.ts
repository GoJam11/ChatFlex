/**
 * 使用 Tauri HTTP 插件的 MCP 协议客户端
 * 绕过浏览器 CORS 限制
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauri } from '@tauri-apps/api/core';
import type { McpToolDefinition } from '@/types/mcp';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface McpListToolsResult {
  tools: McpToolSchema[];
}

interface McpCallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * 使用 Tauri HTTP 的 MCP 传输层
 */
export class TauriMcpTransport {
  private url: string;
  private headers: Record<string, string>;
  private requestId = 0;
  private sessionId?: string;

  constructor(url: string, headers: Record<string, string> = {}) {
    this.url = url;
    this.headers = headers;
  }

  /**
   * 发送 JSON-RPC 请求
   */
  private async sendRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    };

    const fetchFn = isTauri() ? tauriFetch : globalThis.fetch;

    const response = await fetchFn(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...this.headers,
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
      },
      body: JSON.stringify(request),
    });

    // 保存 session ID
    const newSessionId = response.headers.get('Mcp-Session-Id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('Content-Type') || '';

    // 处理 SSE 响应
    if (contentType.includes('text/event-stream')) {
      return this.parseSSEResponse<T>(response);
    }

    // 处理 JSON 响应
    const json = (await response.json()) as JsonRpcResponse<T>;

    if (json.error) {
      throw new Error(`MCP error: ${json.error.message} (code: ${json.error.code})`);
    }

    return json.result as T;
  }

  /**
   * 发送 JSON-RPC 通知（无 id，不期望响应）
   */
  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const fetchFn = isTauri() ? tauriFetch : globalThis.fetch;

    const response = await fetchFn(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...this.headers,
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
      },
      body: JSON.stringify(notification),
    });

    // 保存 session ID
    const newSessionId = response.headers.get('Mcp-Session-Id');
    if (newSessionId) {
      this.sessionId = newSessionId;
    }

    // 通知不需要处理响应体，只要请求成功即可
    if (!response.ok) {
      console.warn(`[TauriMcpTransport] Notification ${method} returned ${response.status}`);
    }
  }

  /**
   * 解析 SSE 响应
   */
  private async parseSSEResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    console.log('[TauriMcpTransport] SSE raw response:', text.substring(0, 500));

    const lines = text.split('\n');

    // 收集多行 data
    let dataBuffer = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataBuffer += line.slice(6);
      } else if (line.startsWith('data:')) {
        // 没有空格的情况
        dataBuffer += line.slice(5);
      } else if (line === '' && dataBuffer) {
        // 空行表示事件结束，尝试解析
        try {
          const json = JSON.parse(dataBuffer) as JsonRpcResponse<T>;
          console.log('[TauriMcpTransport] Parsed SSE JSON:', json);
          if (json.error) {
            throw new Error(`MCP error: ${json.error.message}`);
          }
          if (json.result !== undefined) {
            return json.result;
          }
        } catch (e) {
          console.log('[TauriMcpTransport] Failed to parse SSE data:', dataBuffer, e);
        }
        dataBuffer = '';
      }
    }

    // 尝试解析剩余的 buffer
    if (dataBuffer) {
      try {
        const json = JSON.parse(dataBuffer) as JsonRpcResponse<T>;
        console.log('[TauriMcpTransport] Parsed remaining SSE JSON:', json);
        if (json.error) {
          throw new Error(`MCP error: ${json.error.message}`);
        }
        if (json.result !== undefined) {
          return json.result;
        }
      } catch (e) {
        console.log('[TauriMcpTransport] Failed to parse remaining SSE data:', dataBuffer, e);
      }
    }

    // 如果整个响应就是 JSON（某些服务器可能不遵循 SSE 格式）
    try {
      const json = JSON.parse(text) as JsonRpcResponse<T>;
      console.log('[TauriMcpTransport] Parsed as plain JSON:', json);
      if (json.error) {
        throw new Error(`MCP error: ${json.error.message}`);
      }
      if (json.result !== undefined) {
        return json.result;
      }
    } catch {
      // 不是有效的 JSON
    }

    throw new Error(`No valid response in SSE stream. Raw: ${text.substring(0, 200)}`);
  }

  /**
   * 初始化连接
   */
  async initialize(): Promise<void> {
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'chatflex',
        version: '1.0.0',
      },
    });

    // 发送 initialized 通知
    await this.sendNotification('notifications/initialized', {});
  }

  /**
   * 获取工具列表
   */
  async listTools(): Promise<McpToolDefinition[]> {
    const result = await this.sendRequest<McpListToolsResult>('tools/list', {});
    return (result.tools || []).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.sendRequest<McpCallToolResult>('tools/call', {
      name,
      arguments: args,
    });

    // 提取文本内容
    const textParts = (result.content || [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text as string);

    if (textParts.length > 0) {
      return textParts.join('\n');
    }

    return JSON.stringify(result.content);
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    // HTTP 传输不需要显式关闭
    this.sessionId = undefined;
  }
}
