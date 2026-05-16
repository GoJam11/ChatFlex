import { ref, watch, onUnmounted } from 'vue';
import type { Chat } from '@/types/chat';
import { isChatSearchEnabled } from '@/config/chatSearch';
import { searchChatsInDatabase } from './chatSearchService';
import type { ChatSearchStats } from '@/types/search';

const SEARCH_DEBOUNCE_MS = 300;

export function useChatSearch() {
    const searchQuery = ref('');
    const isSearching = ref(false);
    const searchResults = ref<Chat[]>([]);
    const searchStats = ref<ChatSearchStats | null>(null);

    let searchTimeout: ReturnType<typeof setTimeout> | null = null;

    const resetState = () => {
        searchResults.value = [];
        searchStats.value = null;
        isSearching.value = false;
    };

    const performSearch = async (query: string) => {
        const trimmed = query.trim();
        if (!trimmed) {
            resetState();
            return;
        }

        if (!isChatSearchEnabled) {
            resetState();
            return;
        }

        try {
            isSearching.value = true;
            const response = await searchChatsInDatabase(trimmed, { limit: 50 });
            const uniqueChats = new Map<string, Chat>();

            for (const match of response.results) {
                if (!uniqueChats.has(match.chat.id)) {
                    uniqueChats.set(match.chat.id, match.chat);
                }
            }

            const sorted = Array.from(uniqueChats.values()).sort(
                (a, b) => (b.lastMsgTime ?? b.time ?? 0) - (a.lastMsgTime ?? a.time ?? 0),
            );

            searchResults.value = sorted;
            searchStats.value = response.stats;
        } catch (error) {
            console.error('[useChatSearch] 搜索出错:', error);
            resetState();
        } finally {
            isSearching.value = false;
        }
    };

    const clearDebounce = () => {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
            searchTimeout = null;
        }
    };

    watch(searchQuery, (newQuery) => {
        clearDebounce();

        const trimmed = newQuery.trim();
        if (!trimmed) {
            resetState();
            return;
        }

        isSearching.value = true;
        searchTimeout = setTimeout(() => {
            void performSearch(newQuery);
        }, SEARCH_DEBOUNCE_MS);
    });

    onUnmounted(() => {
        clearDebounce();
    });

    const clearSearch = () => {
        clearDebounce();
        searchQuery.value = '';
        resetState();
    };

    return {
        searchQuery,
        isSearching,
        searchResults,
        searchStats,
        clearSearch,
        prepareSearch: () => undefined,
    };
}
