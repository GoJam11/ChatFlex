const normalizeBooleanFlag = (value: unknown, fallback: boolean): boolean => {
  if (value === undefined || value === null) {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

const rawChatSearchFlag =
  import.meta.env.VITE_ENABLE_CHAT_SEARCH_INDEX ?? import.meta.env.VITE_ENABLE_CHAT_SEARCH;

export const isChatSearchEnabled = normalizeBooleanFlag(rawChatSearchFlag, true);
