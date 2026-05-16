import type { ProviderRecord } from '@/types/provider';
import { chatFlexDb } from './chatflex-db';

const providerTable = chatFlexDb.providers;

export class ProviderDatabase {
  async getAllProviders(): Promise<ProviderRecord[]> {
    return providerTable.toArray();
  }

  async getProvider(key: string): Promise<ProviderRecord | undefined> {
    return providerTable.get(key);
  }

  async putProvider(provider: ProviderRecord): Promise<string> {
    await providerTable.put(provider);
    return provider.key;
  }

  async bulkPutProviders(providers: ProviderRecord[]): Promise<void> {
    if (!providers.length) {
      return;
    }
    await providerTable.bulkPut(providers);
  }

  async updateProvider(
    key: string,
    updates: Partial<ProviderRecord>,
  ): Promise<void> {
    await providerTable.update(key, updates);
  }

  async deleteProvider(key: string): Promise<void> {
    await providerTable.delete(key);
  }

  async deleteProviders(keys: string[]): Promise<void> {
    if (!keys.length) {
      return;
    }
    await providerTable.bulkDelete(keys);
  }

  async clearProviders(): Promise<void> {
    await providerTable.clear();
  }
}

export const providerDb = new ProviderDatabase();
