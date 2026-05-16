/**
 * 图片数据接口 - 用于消息中的图片内容，
 */
import type {
    LanguageModelUsage,
    LanguageModelResponseMetadata,
} from 'ai';
import type { ToolResultOutput } from '@ai-sdk/provider-utils';
export type { LanguageModelUsage };
export interface ImageData {
    type: "image";
    imageId: number; // ID from image.db
    alt?: string; // 可选的图片描述
    mimeType?: string; // 图片MIME类型，如 'image/jpeg'
    // 可选: width/height，如果能在存入 image.db 时获取并存储，对前端渲染有好处
}

/**
 * 图片记录接口 - 用于持久化存储图片
 */
export interface ImageRecord {
    id?: number; // 自动生成的主键 ID
    name: string; // 图片名称
    filePath?: string; // 相对于 appData 的文件路径 (例如: "images/xxx.png")
    blob?: Blob; // 图片二进制数据 (兼容旧数据，新数据使用 filePath)
    mimeType: string; // 图片 MIME 类型
    size: number; // 文件大小（字节）
    createdAt: Date; // 创建时间
    metadata?: Record<string, any>; // 可选的元数据
}

/**
 * 消息内容 - 可以是文本、图片或文本与图片的混合数组
 */
export type MessageContent = string | ImageData | readonly (string | ImageData)[];
/**
 * 消息角色枚举
 */
export type MessageRole = "user" | "assistant" | "tool";

export interface ToolInvocation {
    toolCallId: string;
    toolName: string;
    input?: unknown;
    output?: ToolResultOutput;
    providerExecuted?: boolean;
    title?: string;
}

// ==================== 工具调用相关类型 ====================

/**
 * 工具定义 - 描述可用工具的接口
 */


/**
 * 工具调用 - 请求执行特定工具
 */


/**
 * 工具响应 - 工具执行结果
 */


/**
 * 消息基础接口 - 包含所有消息通用字段
 */
export interface BaseMsg {
    content: MessageContent; // 消息内容
    role: MessageRole; // 消息角色：用户/助手
    id: string; // 消息唯一标识
    model?: string; // 使用的AI模型名称（纯模型名，如 "gpt-4.1-nano"）
    provider?: string; // 供应商标识（如 "openai", "custom_https://api.example.com/v1_123456"）
    timestamp?: number; // 消息时间戳
    short?: string; // 消息简短摘要
    thinkContent?: string; // 思考内容（仅用于显示，不进入上下文）
    usage?: LanguageModelUsage; // Token使用信息
    // 精确响应类型（与 AI SDK streamText().response 对齐）
    raw?: LanguageModelResponseMetadata & {
        messages: ReadonlyArray<unknown>;
        body?: unknown;
    };
    // 响应产生的原始消息列表（assistant/tool）
    messages?: readonly unknown[];
    toolInvocation?: ToolInvocation;
}

/**
 * 消息对象接口 - 统一类型，包含可选的错误消息字段
 */
export interface Msg extends BaseMsg {
    status: MessageStatus;
    errorMsg?: string; // 可选的错误消息字段，仅在 status 为 ERROR 时有值
}

/**
 * 消息记录基础接口 - 包含所有消息记录通用字段
 */
export interface BaseMessageRecord {
    id: string; // 消息ID
    chatId: string; // 所属聊天ID
    content: MessageContent; // 消息内容
    short: string; // 消息简短描述
    role: MessageRole; // 消息角色
    model?: string; // 使用的AI模型名称（纯模型名，如 "gpt-4.1-nano"）
    provider?: string; // 供应商标识（如 "openai", "custom_https://api.example.com/v1_123456"）
    timestamp: number; // 时间戳
    thinkContent?: string; // 思考内容（仅用于显示，不进入上下文）
    usage?: LanguageModelUsage; // Token使用信息
    // 完整的响应JSON数据（来自 AI SDK）
    raw?: LanguageModelResponseMetadata & {
        messages: ReadonlyArray<unknown>;
        body?: unknown;
    };
    // 模型返回的原始messages列表（只读）
    messages?: readonly unknown[];
    toolInvocation?: ToolInvocation;
}

/**
 * 消息记录接口 - 统一类型，包含可选的错误消息字段
 */
export interface MessageRecord extends BaseMessageRecord {
    status: MessageStatus;
    errorMsg?: string; // 可选的错误消息字段，仅在 status 为 ERROR 时有值
}

// ==================== 类型守卫函数 ====================

/**
 * 检查消息是否为错误消息
 */
export function isErrorMsg(msg: Msg): boolean {
    return msg.status === MessageStatus.ERROR;
}

/**
 * 检查消息是否为正常消息
 */
export function isNormalMsg(msg: Msg): boolean {
    return msg.status !== MessageStatus.ERROR;
}

/**
 * 检查消息记录是否为错误消息记录
 */
export function isErrorMessageRecord(record: MessageRecord): boolean {
    return record.status === MessageStatus.ERROR;
}
// ==================== 状态管理相关类型 ====================
/**
 * 消息处理状态枚举
 */
export enum MessageStatus {
    IDLE = "idle", // 空闲
    WAITING = "waiting", // 等待响应
    THINKING = "thinking", // 思考中（输出思维链）
    GENERATING = "generating", // 生成中（输出正文）
    COMPLETED = "completed", // 已完成
    ERROR = "error", // 错误
}
