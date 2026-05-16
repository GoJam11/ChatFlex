/**
 * AI Provider 接口定义
 *
 * 统一的AI服务提供商接口，用于抽象不同的AI服务
 * 目标：避免配置信息到处传递，简化AI调用
 */

import type { LanguageModelUsage } from 'ai';

// AI消息接口 - 兼容OpenAI格式
export interface AIMessage {
    role: "system" | "user" | "assistant";
    content: string | any[]; // 支持文本或混合内容（文本+图片）
}

// AI请求选项
export interface AIRequestOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    stream?: boolean;
    provider?: string; // 指定使用的AI提供商 (openai, ollama, etc.)
    onUpdate?: (content: string, thinkContent?: string) => void; // 流式更新回调
    // 其他可能的参数
    [key: string]: any;
}

// AI响应结果
export interface AIResponse {
    success: boolean;
    content?: string;
    thinkContent?: string; // 思维链内容
    error?: string;
    usage?: LanguageModelUsage; // Token 使用信息
    raw?: any; // 完整的响应JSON数据
    finishReason?: string; // 完成原因 (如 content_filter, length, stop 等)
}

// AI Provider 核心接口
export interface AIProvider {
    /**
     * 发送AI请求
     * @param messages 消息列表
     * @param options 可选的参数覆盖
     */
    sendRequest(
        messages: AIMessage[],
        options?: AIRequestOptions
    ): Promise<AIResponse>;

    /**
     * 获取模型信息
     */
    getModel(): string;

    /**
     * 获取提供商信息
     */
    getProvider(): string;

    /**
     * 获取完整的模型配置信息
     */
    getModelInfo(): {
        model: string;
        provider: string;
        temperature: number;
        maxTokens?: number;
    };

    /**
     * 获取可用模型列表
     */
    getModels(): Promise<string[]>;
}
