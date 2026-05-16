import type { Chat, ChatRecord } from '@/types/chat';

export function mapChatRecordToChat(record: ChatRecord): Chat {
    return {
        id: record.id,
        short: record.short,
        time: record.time,
        lastMsgPreview: record.lastMsgPreview || '',
        lastMsgTime: record.lastMsgTime,
        messageCount: record.messageCount || 0,
        pinned: record.pinned || false,
        systemPrompt: record.systemPrompt,
        historyMsgCount: record.historyMsgCount,
        temperature: record.temperature,
        maxTokens: record.maxTokens,
        topP: record.topP,
        frequencyPenalty: record.frequencyPenalty,
        model: record.model,
        provider: record.provider,
        memoryTable: record.memoryTable,
        reasoningStrength: record.reasoningStrength ?? 'default',
    };
}
