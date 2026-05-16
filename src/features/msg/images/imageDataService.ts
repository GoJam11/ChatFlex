/**
 * ImageDataService
 *
 * 图片数据服务，支持文件系统存储（Tauri 环境）和 IndexedDB 存储（Web 环境）
 */

import { imageDb } from '@/persistence/ImageDatabase';
import { imageFileService } from '@/persistence/imageFileService';
import { ImageRecord } from '@/types/msg.ts';
import { isTauri } from '@tauri-apps/api/core';

export class ImageDataService {
  private static instance: ImageDataService;

  static getInstance(): ImageDataService {
    if (!ImageDataService.instance) {
      ImageDataService.instance = new ImageDataService();
    }
    return ImageDataService.instance;
  }

  /**
   * 添加图片文件到数据库
   * 在 Tauri 环境下，图片会保存到文件系统，数据库只存储路径
   * @param file - 图片文件
   * @returns 图片ID，如果失败则抛出错误
   */
  async addImage(file: File): Promise<number> {
    try {
      const blob = new Blob([file], { type: file.type });

      if (isTauri()) {
        // Tauri 环境：保存到文件系统
        const filePath = await imageFileService.saveImage(blob, file.name, file.type);

        const imageRecordData: Omit<ImageRecord, 'id' | 'createdAt'> = {
          name: file.name,
          filePath,
          mimeType: file.type,
          size: file.size,
        };

        const imageId = await imageDb.addImage(imageRecordData);
        console.log(`[ImageDataService] 成功添加图片到文件系统: ${file.name}, ID: ${imageId}, Path: ${filePath}`);
        return imageId;
      } else {
        // Web 环境：保存到 IndexedDB (兼容模式)
        const imageRecordData: Omit<ImageRecord, 'id' | 'createdAt'> = {
          name: file.name,
          blob,
          mimeType: file.type,
          size: file.size,
        };

        const imageId = await imageDb.addImage(imageRecordData);
        console.log(`[ImageDataService] 成功添加图片到 IndexedDB: ${file.name}, ID: ${imageId}`);
        return imageId;
      }
    } catch (error: any) {
      console.error('[ImageDataService] 添加图片失败:', error);
      throw new Error(error.message || '添加图片失败');
    }
  }

  /**
   * 删除图片
   * @param imageId - 图片ID
   */
  async deleteImage(imageId: number): Promise<void> {
    try {
      const record = await imageDb.getImage(imageId);

      // 如果有文件路径，先删除文件
      if (record?.filePath && isTauri()) {
        await imageFileService.deleteImage(record.filePath);
      }

      await imageDb.deleteImage(imageId);
      console.log(`[ImageDataService] 成功删除图片 ID: ${imageId}`);
    } catch (error: any) {
      console.error('[ImageDataService] 删除图片失败:', error);
      throw new Error(error.message || '删除图片失败');
    }
  }

  /**
   * 获取图片的可渲染 URL
   * 优先从文件系统读取，兼容旧的 Blob 数据
   * @param imageId - 图片ID
   * @returns 可用于 img src 的 URL，如果图片不存在则返回 null
   */
  async getBlobUrl(imageId: number): Promise<string | null> {
    try {
      const record = await imageDb.getImage(imageId);
      if (!record) {
        console.warn(`[ImageDataService] 图片不存在, ID: ${imageId}`);
        return null;
      }

      // 优先使用文件系统
      if (record.filePath && isTauri()) {
        const url = await imageFileService.getImageUrl(record.filePath);
        console.log(`[ImageDataService] 从文件系统获取图片 URL, ID: ${imageId}`);
        return url;
      }

      // 兼容旧数据：使用 Blob
      if (record.blob) {
        const blobUrl = URL.createObjectURL(record.blob);
        console.log(`[ImageDataService] 从 Blob 获取图片 URL, ID: ${imageId}`);
        return blobUrl;
      }

      console.warn(`[ImageDataService] 图片无有效数据, ID: ${imageId}`);
      return null;
    } catch (error: any) {
      console.error('[ImageDataService] 获取图片 URL 失败:', error);
      throw new Error(error.message || '获取图片 URL 失败');
    }
  }

  /**
   * 释放 Blob URL (仅对 Blob URL 有效，文件系统 URL 无需释放)
   * @param url - 要释放的 URL
   */
  releaseBlobUrl(url: string): void {
    try {
      // 只有 blob: 协议的 URL 需要释放
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
        console.log(`[ImageDataService] 释放 Blob URL: ${url}`);
      }
    } catch (error: any) {
      console.warn('[ImageDataService] 释放 URL 失败:', error);
    }
  }

  /**
   * 获取图片文件的完整路径（用于预览）
   * @param imageId - 图片ID
   * @returns 完整的文件系统路径，如果不存在则返回 null
   */
  async getImageFilePath(imageId: number): Promise<string | null> {
    try {
      const record = await imageDb.getImage(imageId);
      if (!record) {
        return null;
      }

      if (record.filePath && isTauri()) {
        return await imageFileService.getFullPath(record.filePath);
      }

      return null;
    } catch (error: any) {
      console.error('[ImageDataService] 获取图片路径失败:', error);
      return null;
    }
  }

  /**
   * 根据ID获取图片记录
   * @param id - 图片ID
   * @returns 图片记录，如果不存在则返回null
   */
  async findById(id: number): Promise<ImageRecord | null> {
    try {
      const image = await imageDb.getImage(id);
      return image || null;
    } catch (error: any) {
      console.error('[ImageDataService] 获取图片记录失败:', error);
      throw new Error(error.message || '获取图片记录失败');
    }
  }

  /**
   * 获取所有图片信息（不包括blob数据）
   * @returns 图片信息列表
   */
  async getAllImageInfo(): Promise<Omit<ImageRecord, 'blob'>[]> {
    try {
      return await imageDb.getAllImageInfo();
    } catch (error: any) {
      console.error('[ImageDataService] 获取图片信息列表失败:', error);
      throw new Error(error.message || '获取图片信息列表失败');
    }
  }

  /**
   * 清空所有图片
   */
  async clear(): Promise<void> {
    try {
      // 如果在 Tauri 环境，先获取所有图片并删除文件
      if (isTauri()) {
        const allImages = await imageDb.getAllImageInfo();
        for (const img of allImages) {
          if (img.filePath) {
            await imageFileService.deleteImage(img.filePath);
          }
        }
      }

      await imageDb.clearImages();
      console.log('[ImageDataService] 成功清空所有图片');
    } catch (error: any) {
      console.error('[ImageDataService] 清空图片失败:', error);
      throw new Error(error.message || '清空图片失败');
    }
  }

  /**
   * 从文件创建图片记录数据（不保存到数据库）
   * @param file - 图片文件
   * @returns 图片记录数据
   */
  createImageRecordFromFile(file: File) {
    return {
      name: file.name,
      blob: new Blob([file], { type: file.type }),
      mimeType: file.type,
      size: file.size,
    };
  }
}
