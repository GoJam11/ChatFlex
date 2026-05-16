/**
 * Core Types Index
 *
 * 统一导出所有核心类型定义
 */
/**
 * 为了减小开发难度，我将核心数据结构维护在core文件夹中，其他ui store 必须围绕model设计
 */

// Chat相关类型
export type * from "./chat";

// Provider相关类型和工具函数
export * from "./provider.ts";

// AI Provider接口
export type * from "./aiProvider";
export type { MessageStatus } from "@/types/msg.ts";
export type { MessageRecord } from "@/types/msg.ts";
export type { Msg } from "@/types/msg.ts";
export type { MessageRole } from "@/types/msg.ts";
export type { MessageContent } from "@/types/msg.ts";
export type { ImageRecord } from "@/types/msg.ts";
export type { ImageData } from "@/types/msg.ts";

// Prompt management
export type * from "./prompt";


