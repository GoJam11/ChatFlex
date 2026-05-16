import type { Table } from 'dexie';
import { chatDb } from '@/persistence/ChatDatabase';
import { messageDb } from '@/persistence/MessageDatabase';
import type { ChatRecord } from '@/types/chat';
import type { MessageRecord } from '@/types/msg';
import { mapChatRecordToChat } from '@/features/chat/chatMappers';
import { mapMessageRecordToMsg } from '@/features/msg/messageMappers';
import { generateMessagePreview } from '@/utils/messagePreview';
import { isChatSearchEnabled } from '@/config/chatSearch';
import type {
    ChatSearchMatch,
    ChatSearchOptions,
    ChatSearchResponse,
    ChatSearchStats,
} from '@/types/search';

const DEFAULT_LIMIT = 50;

const emptyStats = (): ChatSearchStats => ({
    searchTime: 0,
    scannedChats: 0,
    scannedMessages: 0,
});

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const toLower = (value: string): string => value.toLowerCase();

const buildSnippet = (text: string, normalizedQuery: string, length = 80): string => {
    const cleanText = text.trim();
    if (!cleanText) {
        return cleanText;
    }

    const lower = cleanText.toLowerCase();
    const index = lower.indexOf(normalizedQuery);
    if (index === -1) {
        return cleanText.slice(0, length);
    }

    const half = Math.max(0, Math.floor((length - normalizedQuery.length) / 2));
    const start = Math.max(0, index - half);
    const end = Math.min(cleanText.length, start + length);
    return cleanText.slice(start, end);
};

const collectChatMatches = (
    chats: ChatRecord[],
    normalizedQuery: string,
    limit: number,
    chatCache: Map<string, ReturnType<typeof mapChatRecordToChat>>,
): Map<string, ChatSearchMatch> => {
    const matches = new Map<string, ChatSearchMatch>();

    for (const record of chats) {
        const fields = [
            record.short,
            record.lastMsgPreview,
            record.systemPrompt,
            record.model,
            record.provider,
        ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

        const matchedFields = fields.filter((field) => toLower(field).includes(normalizedQuery));
        if (matchedFields.length > 0) {
            const chat = mapChatRecordToChat(record);
            chatCache.set(record.id, chat);
            matches.set(record.id, {
                chat,
                matchType: 'chat',
                matchedFields,
                snippet: buildSnippet(matchedFields[0], normalizedQuery),
            });
        }

        if (matches.size >= limit) {
            break;
        }
    }

    return matches;
};

const getChatFromCache = (
    chatId: string,
    chatRecordMap: Map<string, ChatRecord>,
    chatCache: Map<string, ReturnType<typeof mapChatRecordToChat>>,
) => {
    const cached = chatCache.get(chatId);
    if (cached) {
        return cached;
    }

    const record = chatRecordMap.get(chatId);
    if (!record) {
        return undefined;
    }

    const chat = mapChatRecordToChat(record);
    chatCache.set(chatId, chat);
    return chat;
};

const tryCollectMessageMatches = async (
    messagesTable: Table<MessageRecord, string>,
    normalizedQuery: string,
    limit: number,
    chatRecordMap: Map<string, ChatRecord>,
    chatCache: Map<string, ReturnType<typeof mapChatRecordToChat>>,
    matches: Map<string, ChatSearchMatch>,
): Promise<number> => {
    let scannedMessages = 0;

    if (matches.size >= limit) {
        return scannedMessages;
    }

    await messagesTable
        .orderBy('timestamp')
        .reverse()
        .each((record) => {
            scannedMessages += 1;

            if (matches.size >= limit) {
                return false;
            }

            const candidates: string[] = [];
            if (record.short) {
                candidates.push(record.short);
            }
            const preview = generateMessagePreview(record.content);
            if (preview) {
                candidates.push(preview);
            }
            if (typeof record.thinkContent === 'string' && record.thinkContent.trim()) {
                candidates.push(record.thinkContent);
            }

            const matchedText = candidates.find((candidate) => toLower(candidate).includes(normalizedQuery));
            if (!matchedText) {
                return;
            }

            const chat = getChatFromCache(record.chatId, chatRecordMap, chatCache);
            if (!chat) {
                return;
            }

            const existing = matches.get(record.chatId);
            const snippet = buildSnippet(matchedText, normalizedQuery);
            const message = mapMessageRecordToMsg(record);

            if (!existing) {
                matches.set(record.chatId, {
                    chat,
                    matchType: 'message',
                    matchedFields: ['message'],
                    matchedMessage: message,
                    snippet,
                });
                return;
            }

            if (!existing.matchedFields.includes('message')) {
                existing.matchedFields = [...existing.matchedFields, 'message'];
            }

            if (!existing.matchedMessage) {
                existing.matchedMessage = message;
                existing.snippet = existing.snippet ?? snippet;
            }
        });

    return scannedMessages;
};

export const searchChatsInDatabase = async (
    query: string,
    options: ChatSearchOptions = {},
): Promise<ChatSearchResponse> => {
    if (!isChatSearchEnabled) {
        return { results: [], stats: emptyStats() };
    }

    const trimmed = query.trim();
    if (!trimmed) {
        return { results: [], stats: emptyStats() };
    }

    const normalizedQuery = trimmed.toLowerCase();
    const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
    const start = now();

    const chatRecords = await chatDb.chats.toArray();
    const chatRecordMap = new Map<string, ChatRecord>();
    const chatCache = new Map<string, ReturnType<typeof mapChatRecordToChat>>();

    for (const record of chatRecords) {
        chatRecordMap.set(record.id, record);
    }

    const matches = collectChatMatches(chatRecords, normalizedQuery, limit, chatCache);

    let scannedMessages = 0;
    if (options.includeMessages !== false && matches.size < limit) {
        scannedMessages = await tryCollectMessageMatches(
            messageDb.messages,
            normalizedQuery,
            limit,
            chatRecordMap,
            chatCache,
            matches,
        );
    }

    const end = now();

    const sortedResults = Array.from(matches.values())
        .sort((a, b) => (b.chat.lastMsgTime ?? b.chat.time ?? 0) - (a.chat.lastMsgTime ?? a.chat.time ?? 0))
        .slice(0, limit);

    return {
        results: sortedResults,
        stats: {
            searchTime: end - start,
            scannedChats: chatRecords.length,
            scannedMessages,
        },
    };
};
