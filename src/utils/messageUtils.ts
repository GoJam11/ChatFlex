import { MessageContent, ImageData } from "@/types/msg.ts";

function isImageData(content: unknown): content is ImageData {
    return (
        !!content &&
        typeof content === "object" &&
        !Array.isArray(content) &&
        (content as { type?: unknown }).type === "image"
    );
}

/**
 * 将MessageContent转换为字符串
 * @param content 消息内容
 * @returns 转换后的字符串
 */
export function contentToString(content: MessageContent): string {
    if (typeof content === "string") {
        return content;
    } else if (Array.isArray(content)) {
        return content
            .map((item) => {
                if (typeof item === "string") {
                    return item;
                } else if (isImageData(item)) {
                    return item.alt ? `[图片: ${item.alt}]` : "[图片]";
                }
                return "";
            })
            .join("\n");
    } else if (isImageData(content)) {
        return content.alt ? `[图片: ${content.alt}]` : "[图片]";
    }
    return "";
}

/**
 * 获取消息预览文本
 * @param content 消息内容
 * @param maxLength 最大长度
 * @returns 预览文本
 */
export function getPreviewText(
    content: MessageContent | undefined,
    maxLength: number = 30
): string {
    if (!content) return "新会话";

    if (typeof content === "string") {
        return content.slice(0, maxLength);
    } else if (Array.isArray(content)) {
        const firstItem = content[0];
        if (typeof firstItem === "string") {
            return firstItem.slice(0, maxLength);
        } else if (isImageData(firstItem)) {
            return firstItem.alt
                ? `[图片: ${firstItem.alt.slice(0, 20)}]`
                : "[图片]";
        }
    } else if (isImageData(content)) {
        return content.alt ? `[图片: ${content.alt.slice(0, 20)}]` : "[图片]";
    }

    return "新会话";
}

/**
 * 处理字符串中的<think>标签（统一的思维链处理函数）
 * @param content 字符串内容
 * @returns 处理后的主要内容和思考内容
 */
export function processThinkContent(content: string): { content: string; thinkContent?: string } {
    // 使用正则表达式匹配<think>标签，支持多个标签
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    
    if (thinkMatch) {
        const thinkContent = thinkMatch[1].trim();
        const mainContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        
        return {
            content: mainContent,
            thinkContent: thinkContent || undefined
        };
    }

    // 检查是否有未闭合的<think>标签
    const thinkStartIndex = content.indexOf("<think>");
    if (thinkStartIndex !== -1) {
        const thinkEndIndex = content.indexOf("</think>", thinkStartIndex);
        if (thinkEndIndex === -1) {
            // 如果只有开始标签，将其后的所有内容作为思考内容
            const mainContent = content.substring(0, thinkStartIndex).trim();
            const thinkContent = content
                .substring(thinkStartIndex + "<think>".length)
                .trim();
            return { content: mainContent, thinkContent: thinkContent || undefined };
        }
    }

    return {
        content: content.trim()
    };
}

/**
 * 格式化模型名称显示（主要用于模型选择器）
 * 将 model|provider 格式转换为用户友好的显示名称
 * 注意：消息显示中应直接使用分离后的 model 字段，不需要此函数
 * @param modelIdentifier 模型标识符，格式为 model|provider
 * @param providerList 可选的供应商列表，用于查找用户友好的供应商名称
 * @returns 格式化后的模型名称
 */
export function formatModelName(
    modelIdentifier: string,
    providerList?: Array<{ key: string; displayName: string }>
): string {
    if (!modelIdentifier) {
        return "";
    }

    // 如果不包含分隔符，直接返回
    if (!modelIdentifier.includes("|")) {
        return modelIdentifier;
    }

    // 分割 model|provider 格式
    const parts = modelIdentifier.split("|");
    if (parts.length !== 2) {
        return modelIdentifier;
    }

    const [model, providerKey] = parts;

    // 查找供应商的用户友好名称
    let providerDisplayName = providerKey;
    if (providerList) {
        const provider = providerList.find(p => p.key === providerKey);
        if (provider) {
            providerDisplayName = provider.displayName;
        }
    }

    // 对于所有供应商（包括自定义），都显示 model(providerDisplayName) 格式
    return `${model}(${providerDisplayName})`;
}

/**
 * 从消息内容中提取图片数据
 * @param content 消息内容
 * @returns 图片数据数组
 */
export function extractImagesFromContent(content: MessageContent): ImageData[] {
    if (!content) return [];

    if (Array.isArray(content)) {
        return content.filter(isImageData);
    } else if (isImageData(content)) {
        return [content];
    }

    return [];
}

/**
 * 过滤掉消息内容中的图片，只保留文本内容
 * @param content 消息内容
 * @returns 过滤后的消息内容
 */
export function filterImagesFromContent(content: MessageContent): MessageContent | null {
    if (!content) return content;

    if (Array.isArray(content)) {
        const filtered = content.filter((part) => !isImageData(part));
        return filtered.length > 0 ? filtered : null;
    } else if (isImageData(content)) {
        return null;
    }

    return content;
}

/**
 * 提取消息内容中的纯文本内容
 * @param content 消息内容
 * @returns 纯文本内容
 */
export function extractTextFromContent(content: MessageContent): string {
    if (!content) return "";

    if (typeof content === "string") {
        return content;
    } else if (Array.isArray(content)) {
        return content
            .filter((part) => typeof part === "string")
            .join("\n");
    }

    return "";
}

/**
 * 重构消息内容，用新的文本内容替换原有文本，保留图片
 * @param originalContent 原始消息内容
 * @param newTextContent 新的文本内容
 * @returns 重构后的消息内容
 */
export function reconstructContentWithNewText(
    originalContent: MessageContent,
    newTextContent: string
): MessageContent {
    if (!originalContent) return newTextContent;

    if (typeof originalContent === "string") {
        return newTextContent;
    } else if (Array.isArray(originalContent)) {
        const images = originalContent.filter(isImageData);
        
        if (images.length === 0) {
            return newTextContent;
        }
        
        // 如果有图片，将新文本和图片重新组合
        const result: (string | ImageData)[] = [];
        if (newTextContent.trim()) {
            result.push(newTextContent);
        }
        result.push(...images);
        
        return result;
    } else if (isImageData(originalContent)) {
        // 如果原内容只是图片，则组合文本和图片
        if (newTextContent.trim()) {
            return [newTextContent, originalContent];
        }
        return originalContent;
    }

    return newTextContent;
}



