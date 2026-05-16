import type { UIMessage } from 'ai';
import { ImageDataService } from '@/features/msg/images/imageDataService';
import { imageFileService } from '@/persistence/imageFileService';
import type { ImageData, MessageRecord } from '@/types/msg';
import { isTauri } from '@tauri-apps/api/core';

const IMAGE_PLACEHOLDER = '[图片]';
const imageDataService = ImageDataService.getInstance();

const blobToDataUrl = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unexpected FileReader result type.'));
      }
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to convert blob to data URL.'));
    };

    reader.readAsDataURL(blob);
  });

const uint8ArrayToDataUrl = (bytes: Uint8Array, mimeType: string): string => {
  const base64 = btoa(String.fromCharCode(...bytes));
  return `data:${mimeType};base64,${base64}`;
};

const isImageData = (content: unknown): content is ImageData =>
  typeof content === 'object' &&
  content !== null &&
  (content as ImageData).type === 'image' &&
  typeof (content as ImageData).imageId === 'number';

const buildFilePartFromImage = async (
  imageContent: ImageData,
): Promise<UIMessage['parts'][number] | null> => {
  try {
    const record = await imageDataService.findById(imageContent.imageId);

    if (!record) {
      return null;
    }

    const mediaType = imageContent.mimeType || record.mimeType || 'image/png';

    // 优先从文件系统读取
    if (record.filePath && isTauri()) {
      try {
        const bytes = await imageFileService.readImage(record.filePath);
        const dataUrl = uint8ArrayToDataUrl(bytes, mediaType);

        return {
          type: 'file',
          mediaType,
          filename: imageContent.alt || record.name,
          url: dataUrl,
        } as UIMessage['parts'][number];
      } catch (error) {
        console.warn('[send] 从文件系统读取图片失败，尝试使用 Blob:', error);
      }
    }

    // 兼容旧数据：使用 Blob
    if (record.blob) {
      const dataUrl = await blobToDataUrl(record.blob);

      return {
        type: 'file',
        mediaType,
        filename: imageContent.alt || record.name,
        url: dataUrl,
      } as UIMessage['parts'][number];
    }

    console.warn('[send] 图片无有效数据:', imageContent.imageId);
    return null;
  } catch (error) {
    console.warn('[send] 图片转换失败:', error);
    return null;
  }
};

export const recordToUIMessage = async (record: MessageRecord): Promise<UIMessage> => {
  if (record.role === 'tool') {
    throw new Error('Tool messages cannot be converted to UI messages.');
  }
  const parts: UIMessage['parts'] = [];

  const contentParts = Array.isArray(record.content)
    ? record.content
    : [record.content];

  for (const contentPart of contentParts) {
    if (typeof contentPart === 'string') {
      if (contentPart.trim().length > 0) {
        parts.push({
          type: 'text',
          text: contentPart,
          state: 'done',
        });
      }
    } else if (isImageData(contentPart)) {
      const filePart = await buildFilePartFromImage(contentPart);
      if (filePart) {
        parts.push(filePart);
      } else {
        parts.push({
          type: 'text',
          text: IMAGE_PLACEHOLDER,
          state: 'done',
        });
      }
    } else if (contentPart !== undefined && contentPart !== null) {
      parts.push({
        type: 'text',
        text: String(contentPart),
        state: 'done',
      });
    }
  }

  if (record.thinkContent) {
    parts.push({
      type: 'reasoning',
      text: record.thinkContent,
      state: 'done',
    });
  }

  if (parts.length === 0) {
    parts.push({
      type: 'text',
      text: '',
      state: 'done',
    });
  }

  return {
    id: record.id,
    role: record.role,
    parts,
  } as UIMessage;
};
