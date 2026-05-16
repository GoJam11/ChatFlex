/**
 * 图片数据迁移脚本
 *
 * 将现有 IndexedDB 中的 Blob 数据迁移到文件系统
 */

import { isTauri } from '@tauri-apps/api/core';
import { imageDb } from './ImageDatabase';
import { imageFileService } from './imageFileService';
import { createLogger } from '@/utils/logger';
const log = createLogger('ImageMigration');

let migrationCompleted = false;

/**
 * 执行图片数据迁移
 * 将所有 blob 存在但 filePath 为空的记录迁移到文件系统
 */
export async function migrateImagesToFileSystem(): Promise<void> {
  if (migrationCompleted) {
    return;
  }

  if (!isTauri()) {
    log.info('非 Tauri 环境，跳过迁移');
    migrationCompleted = true;
    return;
  }

  try {
    log.info('开始图片迁移...');

    // 获取所有图片记录
    const allImages = await imageDb.images.toArray();

    // 筛选需要迁移的记录：有 blob 但没有 filePath
    const imagesToMigrate = allImages.filter((img) => img.blob && !img.filePath);

    if (imagesToMigrate.length === 0) {
      log.info('没有需要迁移的图片');
      migrationCompleted = true;
      return;
    }

    log.info(`发现 ${imagesToMigrate.length} 张图片需要迁移`);

    let successCount = 0;
    let failCount = 0;

    for (const image of imagesToMigrate) {
      try {
        if (!image.id || !image.blob) {
          continue;
        }

        // 将 blob 保存到文件系统
        const filePath = await imageFileService.saveImage(
          image.blob,
          image.name,
          image.mimeType
        );

        // 更新数据库记录：设置 filePath，清空 blob
        await imageDb.updateImage(image.id, {
          filePath,
          blob: undefined,
        });

        successCount++;
        log.debug(`成功迁移图片 ID: ${image.id}, Path: ${filePath}`);
      } catch (error) {
        failCount++;
        log.error(`迁移图片 ID: ${image.id} 失败:`, error);
      }
    }

    log.info(
      `迁移完成: 成功 ${successCount} 张，失败 ${failCount} 张`
    );

    migrationCompleted = true;
  } catch (error) {
    log.error('迁移过程出错:', error);
    migrationCompleted = true;
  }
}
