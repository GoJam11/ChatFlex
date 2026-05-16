/**
 * ImageFileService
 *
 * 文件系统图片存储服务，将图片保存到 $APPDATA/images/ 目录
 */

import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir, writeFile, readFile, remove, exists } from '@tauri-apps/plugin-fs';
import { isTauri } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

const IMAGES_FOLDER = 'images';

/**
 * 生成唯一的文件名
 */
function generateFileName(originalName: string, mimeType: string): string {
  const uuid = crypto.randomUUID();
  const ext = getExtensionFromMimeType(mimeType) || getExtensionFromName(originalName) || 'png';
  return `${uuid}.${ext}`;
}

/**
 * 从 MIME 类型获取文件扩展名
 */
function getExtensionFromMimeType(mimeType: string): string | null {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/ico': 'ico',
    'image/x-icon': 'ico',
  };
  return mimeToExt[mimeType] || null;
}

/**
 * 从文件名获取扩展名
 */
function getExtensionFromName(name: string): string | null {
  const match = name.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : null;
}

class ImageFileService {
  private static instance: ImageFileService;
  private imagesDir: string | null = null;

  static getInstance(): ImageFileService {
    if (!ImageFileService.instance) {
      ImageFileService.instance = new ImageFileService();
    }
    return ImageFileService.instance;
  }

  /**
   * 获取图片存储目录的完整路径
   */
  async getImagesDir(): Promise<string> {
    if (this.imagesDir) {
      return this.imagesDir;
    }
    const appData = await appDataDir();
    this.imagesDir = await join(appData, IMAGES_FOLDER);
    return this.imagesDir;
  }

  /**
   * 确保图片目录存在
   */
  async ensureImagesDir(): Promise<void> {
    const dir = await this.getImagesDir();
    const dirExists = await exists(dir);
    if (!dirExists) {
      await mkdir(dir, { recursive: true });
    }
  }

  /**
   * 保存图片到文件系统
   * @param blob - 图片 Blob 数据
   * @param originalName - 原始文件名
   * @param mimeType - MIME 类型
   * @returns 相对于 appData 的文件路径 (例如: "images/xxx.png")
   */
  async saveImage(blob: Blob, originalName: string, mimeType: string): Promise<string> {
    if (!isTauri()) {
      throw new Error('saveImage is only available in Tauri environment');
    }

    await this.ensureImagesDir();

    const fileName = generateFileName(originalName, mimeType);
    const relativePath = `${IMAGES_FOLDER}/${fileName}`;
    const fullPath = await this.getFullPath(relativePath);

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    await writeFile(fullPath, bytes);

    console.log(`[ImageFileService] 图片已保存: ${fullPath}`);
    return relativePath;
  }

  /**
   * 从文件系统读取图片
   * @param relativePath - 相对于 appData 的文件路径
   * @returns 图片二进制数据
   */
  async readImage(relativePath: string): Promise<Uint8Array> {
    if (!isTauri()) {
      throw new Error('readImage is only available in Tauri environment');
    }

    const fullPath = await this.getFullPath(relativePath);
    return await readFile(fullPath);
  }

  /**
   * 删除图片文件
   * @param relativePath - 相对于 appData 的文件路径
   */
  async deleteImage(relativePath: string): Promise<void> {
    if (!isTauri()) {
      return;
    }

    try {
      const fullPath = await this.getFullPath(relativePath);
      const fileExists = await exists(fullPath);
      if (fileExists) {
        await remove(fullPath);
        console.log(`[ImageFileService] 图片已删除: ${fullPath}`);
      }
    } catch (error) {
      console.warn(`[ImageFileService] 删除图片失败:`, error);
    }
  }

  /**
   * 获取文件的完整路径
   * @param relativePath - 相对于 appData 的路径
   * @returns 完整的文件系统路径
   */
  async getFullPath(relativePath: string): Promise<string> {
    const appData = await appDataDir();
    return await join(appData, relativePath);
  }

  /**
   * 获取可用于 img src 的 URL
   * @param relativePath - 相对于 appData 的文件路径
   * @returns 可用于渲染的 URL
   */
  async getImageUrl(relativePath: string): Promise<string> {
    if (!isTauri()) {
      throw new Error('getImageUrl is only available in Tauri environment');
    }

    const fullPath = await this.getFullPath(relativePath);
    return convertFileSrc(fullPath);
  }

  /**
   * 检查图片文件是否存在
   * @param relativePath - 相对于 appData 的文件路径
   */
  async imageExists(relativePath: string): Promise<boolean> {
    if (!isTauri()) {
      return false;
    }

    try {
      const fullPath = await this.getFullPath(relativePath);
      return await exists(fullPath);
    } catch {
      return false;
    }
  }
}

export const imageFileService = ImageFileService.getInstance();
