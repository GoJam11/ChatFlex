import type { Msg, MessageRecord } from '@/types/msg';
import { isErrorMessageRecord } from '@/types/msg';

export function mapMessageRecordToMsg(record: MessageRecord): Msg {
    const baseMessage: Msg = {
        id: record.id,
        content: record.content,
        short: record.short || '',
        role: record.role,
        model: record.model,
        provider: record.provider,
        status: record.status,
        timestamp: record.timestamp,
        thinkContent: record.thinkContent,
        usage: record.usage,
        raw: record.raw,
        messages: record.messages,
        toolInvocation: record.toolInvocation,
    } as Msg;

    return isErrorMessageRecord(record)
        ? ({ ...baseMessage, errorMsg: record.errorMsg } as Msg)
        : baseMessage;
}
