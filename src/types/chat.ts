/**
 * 聊天应用的核心数据结构定义
 * 包含所有与聊天相关的接口、类型和枚举
 */

// ==================== 图片数据相关类型 ====================

// ==================== 消息相关类型 ====================

// ==================== 聊天会话相关类型 ====================

/**
 * 记忆表格条目 - 关键词与内容的映射
 */
export interface MemoryEntry {
    keyword: string; // 关键词
    content: string; // 对应的内容
}

/**
 * 聊天会话接口 - 表示一个聊天对话的基本信息
 * 消息列表现在通过独立的MessageStore管理
 */
export type ReasoningStrength = "default" | "low" | "medium" | "high";

export interface Chat {
    short: string; // 会话标题
    id: string; // 会话唯一标识
    time: number; // 创建时间戳
    lastMsgPreview?: string; // 最后一条消息预览
    lastMsgTime?: number; // 最后一条消息的时间戳，用于排序
    messageCount: number; // 消息数量
    pinned?: boolean; // 是否置顶
    systemPrompt?: string; // 会话级别的系统提示
    historyMsgCount?: number; // 会话级别的历史消息数量限制，未设置时使用默认值
    temperature?: number; // 温度参数，控制回答的随机性
    maxTokens?: number; // 最大token数量
    topP?: number; // Top-P参数，控制词汇选择的概率分布
    frequencyPenalty?: number; // 频率惩罚，减少重复内容
    memoryTable?: MemoryEntry[]; // 记忆表格，关键词与内容的映射
    model?: string; // 会话级别的模型，未设置时使用全局模型
    provider?: string; // 会话级别的供应商，未设置时使用全局供应商
    reasoningStrength?: ReasoningStrength; // 推理强度配置
    knowledgeBasePath?: string; // 会话级别的知识库路径
}

/**
 * 聊天记录接口 - 用于持久化存储聊天会话
 */
export interface ChatRecord {
    id: string; // 聊天ID
    short: string; // 聊天标题
    time: number; // 创建时间戳
    lastMsgPreview: string; // 最后一条消息预览
    lastMsgTime?: number; // 最后一条消息的时间戳，用于排序
    messageCount: number; // 消息数量
    updated: number; // 更新时间戳
    pinned?: boolean; // 是否置顶
    systemPrompt?: string; // 会话级别的系统提示
    historyMsgCount?: number; // 会话级别的历史消息数量限制，未设置时使用默认值
    temperature?: number; // 温度参数，控制回答的随机性
    maxTokens?: number; // 最大token数量
    topP?: number; // Top-P参数，控制词汇选择的概率分布
    frequencyPenalty?: number; // 频率惩罚，减少重复内容
    memoryTable?: MemoryEntry[]; // 记忆表格，关键词与内容的映射
    model?: string; // 会话级别的模型，未设置时使用全局模型
    provider?: string; // 会话级别的供应商，未设置时使用全局供应商
    reasoningStrength?: ReasoningStrength; // 推理强度配置
    knowledgeBasePath?: string; // 会话级别的知识库路径
}

