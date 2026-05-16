/**
 * Image Cache Service
 * Provides caching functionality for images to improve performance and reduce network requests
 */

import { chatFlexDb, type CachedImage } from './chatflex-db';

export class ImageCacheService {
  /**
   * Get a cached image by URL
   * @param url - The URL of the image to retrieve
   * @returns Promise<CachedImage | null> - The cached image or null if not found
   */
  async getCachedImage(url: string): Promise<CachedImage | null> {
    try {
      const cachedImage = await chatFlexDb.imageCache.get(url);
      if (cachedImage) {
        let normalizedImage = cachedImage;
        const rawData = cachedImage.data as unknown;

        if (rawData instanceof Uint8Array) {
          // already in the new format
          normalizedImage = cachedImage;
        } else if (typeof Blob !== 'undefined' && rawData instanceof Blob) {
          try {
            const arrayBuffer = await rawData.arrayBuffer();
            const typedArray = new Uint8Array(arrayBuffer);
            normalizedImage = {
              ...cachedImage,
              data: typedArray,
              size: typedArray.byteLength,
            };
            await chatFlexDb.imageCache.put(normalizedImage);
          } catch (normalizationError) {
            console.warn('Failed to normalize cached image blob, removing entry', normalizationError);
            await chatFlexDb.imageCache.delete(url);
            return null;
          }
        } else {
          console.warn('Encountered cached image with unsupported data payload, removing entry', rawData);
          await chatFlexDb.imageCache.delete(url);
          return null;
        }

        // Update last accessed timestamp for LRU-like behaviour
        const now = Date.now();
        await this.updateLastAccessed(url);
        return { ...normalizedImage, lastAccessed: now };
      }
      return null;
    } catch (error) {
      console.error('Error getting cached image:', error);
      return null;
    }
  }

  /**
   * Cache an image
   * @param url - The URL of the image
   * @param data - The image binary data as Uint8Array
   * @param mimeType - The MIME type of the image
   * @param fileName - The extracted filename
   * @returns Promise<void>
   */
  async cacheImage(
    url: string,
    data: Uint8Array,
    mimeType: string,
    fileName: string
  ): Promise<void> {
    try {
      const dataCopy = data.slice(); // clone to avoid retaining caller's buffer
      const now = Date.now();

      const cachedImage: CachedImage = {
        url,
        data: dataCopy,
        mimeType,
        fileName,
        cachedAt: now,
        lastAccessed: now,
        size: dataCopy.byteLength,
      };

      await chatFlexDb.imageCache.put(cachedImage);
    } catch (error) {
      console.error('Error caching image:', error);
      throw error;
    }
  }

  /**
   * Update the last accessed timestamp for a cached image
   * @param url - The URL of the image
   * @returns Promise<void>
   */
  async updateLastAccessed(url: string): Promise<void> {
    try {
      await chatFlexDb.imageCache.update(url, {
        lastAccessed: Date.now(),
      });
    } catch (error) {
      console.error('Error updating last accessed:', error);
    }
  }

  /**
   * Clean old cached images
   * @param daysOld - Number of days old (default: 30)
   * @returns Promise<void>
   */
  async cleanOldCache(daysOld: number = 30): Promise<void> {
    try {
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

      // Find images that haven't been accessed in the specified number of days
      const oldImages = await chatFlexDb.imageCache
        .where('lastAccessed')
        .below(cutoffTime)
        .toArray();

      if (oldImages.length > 0) {
        const urlsToDelete = oldImages.map(img => img.url);
        await chatFlexDb.imageCache.bulkDelete(urlsToDelete);
        console.log(`Cleaned ${oldImages.length} old cached images`);
      }
    } catch (error) {
      console.error('Error cleaning old cache:', error);
      throw error;
    }
  }

  /**
   * Get the total size of the cache in bytes
   * @returns Promise<number> - Total cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    try {
      const allImages = await chatFlexDb.imageCache.toArray();
      return allImages.reduce((total, image) => total + image.size, 0);
    } catch (error) {
      console.error('Error getting cache size:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns Promise<{count: number, totalSize: number, oldestAccess: number, newestAccess: number}>
   */
  async getCacheStats(): Promise<{
    count: number;
    totalSize: number;
    oldestAccess: number;
    newestAccess: number;
  }> {
    try {
      const allImages = await chatFlexDb.imageCache.toArray();

      if (allImages.length === 0) {
        return {
          count: 0,
          totalSize: 0,
          oldestAccess: 0,
          newestAccess: 0,
        };
      }

      const totalSize = allImages.reduce((total, image) => total + image.size, 0);
      const accessTimes = allImages.map(img => img.lastAccessed);

      return {
        count: allImages.length,
        totalSize,
        oldestAccess: Math.min(...accessTimes),
        newestAccess: Math.max(...accessTimes),
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        count: 0,
        totalSize: 0,
        oldestAccess: 0,
        newestAccess: 0,
      };
    }
  }

  /**
   * Clear all cached images
   * @returns Promise<void>
   */
  async clearCache(): Promise<void> {
    try {
      await chatFlexDb.imageCache.clear();
      console.log('All cached images cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Check if an image is cached
   * @param url - The URL of the image
   * @returns Promise<boolean> - True if the image is cached
   */
  async isImageCached(url: string): Promise<boolean> {
    try {
      const count = await chatFlexDb.imageCache.where('url').equals(url).count();
      return count > 0;
    } catch (error) {
      console.error('Error checking if image is cached:', error);
      return false;
    }
  }

  /**
   * Remove a specific cached image
   * @param url - The URL of the image to remove
   * @returns Promise<void>
   */
  async removeCachedImage(url: string): Promise<void> {
    try {
      await chatFlexDb.imageCache.delete(url);
    } catch (error) {
      console.error('Error removing cached image:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const imageCacheService = new ImageCacheService();
