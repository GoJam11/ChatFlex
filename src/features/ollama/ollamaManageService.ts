/**
 * OllamaManageService
 *
 * 专门处理 Ollama 本地模型管理功能的服务
 * 仅包括：获取本地模型列表
 * 不包括对话功能（对话部分已直接使用 AI SDK）
 */

import { corsSafeFetch } from "@/utils/http";

export interface OllamaManageConfig {
    baseURL?: string;
    apiKey?: string;
}

export class OllamaManageService {
    private config: OllamaManageConfig;

    constructor(config: OllamaManageConfig) {
        this.config = config;
    }

    /**
     * 获取用于模型列表查询的baseURL (OpenAI v1 兼容)
     */
    private getModelsListBaseURL(): string {
        const baseURL = this.config.baseURL || "http://127.0.0.1:11434";
        return `${baseURL.replace(/\/$/, "")}/v1`;
    }

    /**
     * 获取Ollama可用模型列表
     * 使用OpenAI兼容的/v1/models端点获取模型列表（统一接口）
     */
    async getModels(): Promise<string[]> {
        try {
            console.log(`[OllamaManageService] 正在获取Ollama模型列表...`);

            const baseURL = this.getModelsListBaseURL();
            const modelsUrl = `${baseURL}/models`;

            console.log(`[OllamaManageService] 请求URL: ${modelsUrl}`);

            const response = await corsSafeFetch(modelsUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.config.apiKey || "ollama"}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // OpenAI兼容 /v1/models 响应格式: { data: [{ id: "model_name", ... }, ...] }
            const models = (data.data || [])
                .map((model: any) => model.id)
                .filter((name: string) => name && name.trim())
                .sort();

            console.log(
                `[OllamaManageService] 成功获取到 ${models.length} 个Ollama模型:`,
                models
            );
            return models;
        } catch (error: any) {
            console.warn(
                `[OllamaManageService] 从Ollama /v1/models获取模型失败:`,
                error.message || error
            );

            // 根据错误类型记录不同的日志
            if (
                error.code === "ENOTFOUND" ||
                error.code === "ECONNREFUSED"
            ) {
                console.error(
                    `[OllamaManageService] 无法连接到Ollama服务，请确保Ollama正在运行`
                );
            } else if (error.status === 429) {
                console.warn(`[OllamaManageService] Ollama请求频率限制`);
            } else {
                console.error(
                    `[OllamaManageService] Ollama API发生未知错误:`,
                    error
                );
            }

            console.log(`[OllamaManageService] 从Ollama /v1/models获取模型失败，返回空列表`);
            return [];
        }
    }

    /**
     * 更新配置
     */
    updateConfig(config: Partial<OllamaManageConfig>): void {
        this.config = { ...this.config, ...config };
    }
}
