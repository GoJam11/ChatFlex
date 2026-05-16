export const CHAT_HISTORY_SEARCH_TOOL_ID = 'chatHistory_search';
export const CHAT_HISTORY_GET_MESSAGES_TOOL_ID = 'chatHistory_getMessages';
export const CHAT_HISTORY_LIST_CHATS_TOOL_ID = 'chatHistory_listChats';

export const CHAT_HISTORY_TOOL_IDS = [
  CHAT_HISTORY_SEARCH_TOOL_ID,
  CHAT_HISTORY_GET_MESSAGES_TOOL_ID,
  CHAT_HISTORY_LIST_CHATS_TOOL_ID,
] as const;

export type ChatHistoryToolId = (typeof CHAT_HISTORY_TOOL_IDS)[number];
