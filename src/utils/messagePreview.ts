import type { MessageContent } from '@/types/msg';

export function generateMessagePreview(content: MessageContent): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const firstText = content.find((item) => typeof item === 'string');
    if (typeof firstText === 'string') {
      return firstText;
    }
    return '[多媒体消息]';
  }

  if (content && typeof content === 'object' && 'type' in content) {
    if ((content as { type?: string }).type === 'image') {
      return '[图片消息]';
    }
  }

  return '[消息]';
}
