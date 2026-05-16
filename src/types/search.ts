import type { Chat } from './chat';
import type { Msg } from './msg';

export type ChatSearchMatchType = 'chat' | 'message';

export interface ChatSearchMatch {
    chat: Chat;
    matchType: ChatSearchMatchType;
    matchedFields: string[];
    matchedMessage?: Msg;
    snippet?: string;
}

export interface ChatSearchStats {
    searchTime: number;
    scannedChats: number;
    scannedMessages: number;
}

export interface ChatSearchOptions {
    limit?: number;
    includeMessages?: boolean;
}

export interface ChatSearchResponse {
    results: ChatSearchMatch[];
    stats: ChatSearchStats;
}
