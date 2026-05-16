import { chatFlexDb, type ProviderModelRecord } from './chatflex-db';

class ProviderModelDatabase {
  async getAllRecords(): Promise<ProviderModelRecord[]> {
    return chatFlexDb.providerModels.toArray();
  }

  async getModels(providerKey: string): Promise<string[]> {
    const records = await chatFlexDb.providerModels
      .where('providerKey')
      .equals(providerKey)
      .toArray();

    return records
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((record) => record.modelName);
  }

  async setModels(providerKey: string, models: string[]): Promise<void> {
    await chatFlexDb.transaction('rw', chatFlexDb.providerModels, async () => {
      await chatFlexDb.providerModels.where('providerKey').equals(providerKey).delete();

      if (models.length === 0) {
        return;
      }

      const timestamp = Date.now();
      await chatFlexDb.providerModels.bulkAdd(
        models.map((modelName, index) => ({
          providerKey,
          modelName,
          createdAt: timestamp + index,
        } satisfies ProviderModelRecord)),
      );
    });
  }

  async addModel(providerKey: string, modelName: string): Promise<void> {
    const exists = await chatFlexDb.providerModels
      .where('providerKey')
      .equals(providerKey)
      .and((record) => record.modelName === modelName)
      .first();

    if (exists) {
      return;
    }

    await chatFlexDb.providerModels.add({
      providerKey,
      modelName,
      createdAt: Date.now(),
    });
  }

  async removeModel(providerKey: string, modelName: string): Promise<void> {
    await chatFlexDb.providerModels
      .where('providerKey')
      .equals(providerKey)
      .and((record) => record.modelName === modelName)
      .delete();
  }

  async clearProvider(providerKey: string): Promise<void> {
    await chatFlexDb.providerModels.where('providerKey').equals(providerKey).delete();
  }
}

export const providerModelDb = new ProviderModelDatabase();
