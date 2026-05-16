export const KNOWLEDGE_BASE_LIST_TOOL_ID = 'knowledgeBase_list';
export const KNOWLEDGE_BASE_READ_TOOL_ID = 'knowledgeBase_read';
export const KNOWLEDGE_BASE_SEARCH_TOOL_ID = 'knowledgeBase_search';

export const KNOWLEDGE_BASE_TOOL_IDS = [
  KNOWLEDGE_BASE_LIST_TOOL_ID,
  KNOWLEDGE_BASE_READ_TOOL_ID,
  KNOWLEDGE_BASE_SEARCH_TOOL_ID,
] as const;

export type KnowledgeBaseToolId = (typeof KNOWLEDGE_BASE_TOOL_IDS)[number];
