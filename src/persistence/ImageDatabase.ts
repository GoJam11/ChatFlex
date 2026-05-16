import { chatFlexDb } from './chatflex-db';
import type { ImageRecord } from '@/types/msg';

const filesTable = chatFlexDb.files;

export class ImageDatabase {
  get images() {
    return filesTable;
  }

  async addImage(image: Omit<ImageRecord, 'id' | 'createdAt'>): Promise<number> {
    const record: ImageRecord = {
      ...image,
      createdAt: new Date(),
    };
    return filesTable.add(record);
  }

  async getImage(id: number): Promise<ImageRecord | undefined> {
    return filesTable.get(id);
  }

  async getAllImageInfo(): Promise<Omit<ImageRecord, 'blob'>[]> {
    const all = await filesTable.toArray();
    return all.map(({ blob, ...rest }) => rest);
  }

  async updateImage(id: number, changes: Partial<Omit<ImageRecord, 'id'>>): Promise<number> {
    return filesTable.update(id, changes);
  }

  async deleteImage(id: number): Promise<void> {
    await filesTable.delete(id);
  }

  async clearImages(): Promise<void> {
    await filesTable.clear();
  }

  async getBlobUrl(id: number): Promise<string | null> {
    const image = await this.getImage(id);
    if (!image || !image.blob) return null;
    return URL.createObjectURL(image.blob);
  }

  releaseBlobUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}

export const imageDb = new ImageDatabase();
