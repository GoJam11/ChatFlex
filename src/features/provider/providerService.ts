import { computed, ref, shallowRef, type ComputedRef } from 'vue';
import { liveQuery, type Subscription } from 'dexie';
import { providerDb } from '@/persistence/ProviderDatabase';
import { providerModelDb } from '@/persistence/ProviderModelDatabase';
import type { ProviderModelRecord } from '@/persistence/chatflex-db';
import { getProviderConfigsArray } from '@/config/provider';
import {
  createProvider,
  mergeProviders,
  type Provider,
  type ProviderCreationData,
  type ProviderRecord,
  fromProviderRecord,
  toProviderRecord,
} from '@/types/provider';
import { handleModelListChange, handleProviderActivation } from '@/features/provider/providerAutoSelection';

const LOCAL_STORAGE_KEY = 'config/providerList';

type SortableProvider = Pick<Provider, 'origin' | 'displayName'>;

function sortProviders(a: SortableProvider, b: SortableProvider): number {
  if (a.origin !== b.origin) {
    return a.origin === 'preset' ? -1 : 1;
  }
  return a.displayName.localeCompare(b.displayName);
}

class ProviderService {
  private static instance: ProviderService | null = null;

  static getInstance(): ProviderService {
    if (!ProviderService.instance) {
      ProviderService.instance = new ProviderService();
    }
    return ProviderService.instance;
  }

  private providerMap = shallowRef(new Map<string, Provider>());
  private providerModelsMap = shallowRef(new Map<string, string[]>());
  private isInitialized = ref(false);
  private initialization: Promise<void>;
  private subscription: Subscription | null = null;

  private providerListComputed: ComputedRef<Provider[]>;
  private activeProvidersComputed: ComputedRef<Provider[]>;

  private constructor() {
    this.providerListComputed = computed(() =>
      Array.from(this.providerMap.value.values()),
    );
    this.activeProvidersComputed = computed(() =>
      this.providerListComputed.value.filter((provider) => provider.isActive),
    );

    this.initialization = this.initialize();
  }

  private buildModelsMap(records: ProviderModelRecord[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt);

    for (const record of sorted) {
      const list = map.get(record.providerKey);
      if (list) {
        list.push(record.modelName);
      } else {
        map.set(record.providerKey, [record.modelName]);
      }
    }

    return map;
  }

  private refreshCaches(
    providerRecords: ProviderRecord[],
    modelsMap: Map<string, string[]>,
  ): void {
    const modelsSnapshot = new Map<string, string[]>();
    modelsMap.forEach((models, key) => {
      modelsSnapshot.set(key, [...models]);
    });

    const providerSnapshot = new Map<string, Provider>();
    const sortedProviders = [...providerRecords].sort(sortProviders);
    sortedProviders.forEach((record) => {
      const models = modelsSnapshot.get(record.key) ?? [];
      providerSnapshot.set(record.key, fromProviderRecord(record, [...models]));
    });

    this.providerModelsMap.value = modelsSnapshot;
    this.providerMap.value = providerSnapshot;
  }

  private async syncCaches(): Promise<void> {
    const providerRecords = await providerDb.getAllProviders();
    const modelRecords = await providerModelDb.getAllRecords();
    const modelsMap = this.buildModelsMap(modelRecords);
    this.refreshCaches(providerRecords, modelsMap);
  }

  private applyProviderSnapshot(provider: Provider): void {
    const models = [...(provider.selectedModels ?? [])];

    const modelsMap = new Map(this.providerModelsMap.value);
    if (models.length > 0) {
      modelsMap.set(provider.key, models);
    } else {
      modelsMap.delete(provider.key);
    }
    this.providerModelsMap.value = modelsMap;

    const providerMap = new Map(this.providerMap.value);
    providerMap.set(provider.key, { ...provider, selectedModels: [...models] });
    this.providerMap.value = providerMap;
  }

  private removeProviderSnapshot(providerId: string): void {
    const modelsMap = new Map(this.providerModelsMap.value);
    modelsMap.delete(providerId);
    this.providerModelsMap.value = modelsMap;

    const providerMap = new Map(this.providerMap.value);
    providerMap.delete(providerId);
    this.providerMap.value = providerMap;
  }

  private async initialize(): Promise<void> {
    try {
      await this.migrateFromLocalStorage();
      await this.ensurePresetProviders();
      await this.syncCaches();
      this.subscribeToChanges();
      this.isInitialized.value = true;
    } catch (error) {
      console.error('[ProviderService] 初始化失败:', error);
      throw error;
    }
  }

  private subscribeToChanges(): void {
    this.subscription?.unsubscribe();
    this.subscription = liveQuery(async () => {
      const providerRecords = await providerDb.getAllProviders();
      const modelRecords = await providerModelDb.getAllRecords();
      return { providerRecords, modelRecords };
    }).subscribe({
      next: ({ providerRecords, modelRecords }) => {
        const modelsMap = this.buildModelsMap(modelRecords);
        this.refreshCaches(providerRecords, modelsMap);
      },
      error: (error) => {
        console.error('[ProviderService] 监听供应商数据失败:', error);
      },
    });
  }

  private async migrateFromLocalStorage(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const storedValue = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!storedValue) {
      return;
    }

    try {
      const parsed = JSON.parse(storedValue) as Record<string, Provider> | Provider[];
      const providers: Provider[] = Array.isArray(parsed)
        ? parsed
        : Object.values(parsed ?? {});

      if (providers.length === 0) {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
        return;
      }

      for (const provider of providers) {
        const models = provider.selectedModels ?? [];
        await providerDb.putProvider(toProviderRecord(provider));
        await providerModelDb.setModels(provider.key, models);
      }
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      console.info('[ProviderService] 已从 localStorage 迁移供应商数据到 Dexie');
    } catch (error) {
      console.warn('[ProviderService] 迁移 localStorage 数据失败，已忽略:', error);
      // 数据损坏时仍然移除，避免重复报错
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }

  private async ensurePresetProviders(): Promise<void> {
    const presets = getProviderConfigsArray();
    const existingRecords = await providerDb.getAllProviders();

    if (existingRecords.length === 0) {
      await providerDb.bulkPutProviders(presets.map(toProviderRecord));
      await Promise.all(
        presets.map(async (provider) => {
          await providerModelDb.setModels(provider.key, provider.selectedModels ?? []);
        }),
      );
      return;
    }

    const modelRecords = await providerModelDb.getAllRecords();
    const modelsMap = this.buildModelsMap(modelRecords);
    const existingProviders = existingRecords.map((record) =>
      fromProviderRecord(record, modelsMap.get(record.key)?.slice() ?? []),
    );

    const merged = mergeProviders(presets, existingProviders);
    await providerDb.bulkPutProviders(merged.map(toProviderRecord));
    await Promise.all(
      merged.map(async (provider) => {
        await providerModelDb.setModels(provider.key, provider.selectedModels ?? []);
      }),
    );

    const mergedKeys = new Set(merged.map((provider) => provider.key));
    const obsoleteKeys = existingRecords
      .filter((record) => !mergedKeys.has(record.key))
      .map((record) => record.key);

    if (obsoleteKeys.length > 0) {
      await providerDb.deleteProviders(obsoleteKeys);
      await Promise.all(obsoleteKeys.map((key) => providerModelDb.clearProvider(key)));
    }
  }

  private async loadProviderWithModels(providerId: string): Promise<Provider | undefined> {
    const record = await providerDb.getProvider(providerId);
    if (!record) {
      return undefined;
    }
    const selectedModels = await providerModelDb.getModels(providerId);
    return fromProviderRecord(record, [...selectedModels]);
  }

  async ready(): Promise<void> {
    if (this.isInitialized.value) {
      return;
    }
    await this.initialization;
  }

  get providerList(): ComputedRef<Provider[]> {
    return this.providerListComputed;
  }

  get activeProviders(): ComputedRef<Provider[]> {
    return this.activeProvidersComputed;
  }

  getProvider(providerId: string): Provider | undefined {
    return this.providerMap.value.get(providerId);
  }

  async addProvider(providerData: ProviderCreationData): Promise<string> {
    await this.ready();
    const newProvider = createProvider(providerData);
    await providerDb.putProvider(toProviderRecord(newProvider));
    await providerModelDb.setModels(newProvider.key, newProvider.selectedModels ?? []);
    this.applyProviderSnapshot(newProvider);
    return newProvider.key;
  }

  async updateProvider(
    providerId: string,
    updatedData: Partial<Provider>,
  ): Promise<void> {
    await this.ready();
    const currentProvider =
      this.providerMap.value.get(providerId) ??
      (await this.loadProviderWithModels(providerId));

    if (!currentProvider) {
      console.warn(
        `[ProviderService] 更新失败，供应商 "${providerId}" 不存在`,
      );
      return;
    }

    const { selectedModels, ...rest } = updatedData;
    const nextSelectedModels = selectedModels ?? currentProvider.selectedModels ?? [];

    const providerSnapshot: Provider = {
      ...currentProvider,
      ...rest,
      selectedModels: [...nextSelectedModels],
    };

    await providerDb.putProvider(toProviderRecord(providerSnapshot));

    if (selectedModels !== undefined) {
      await providerModelDb.setModels(providerId, nextSelectedModels);
      await handleModelListChange(providerId, nextSelectedModels);
    }

    const becameActive = rest.isActive === true && !currentProvider.isActive;
    if (becameActive && providerSnapshot.isActive) {
      await handleProviderActivation(providerSnapshot);
    }

    this.applyProviderSnapshot(providerSnapshot);
  }

  async removeProvider(providerId: string): Promise<boolean> {
    await this.ready();
    const provider = this.providerMap.value.get(providerId);
    if (!provider) {
      return false;
    }

    if (!provider.showDelete) {
      console.warn(
        `Attempted to delete a provider ("${providerId}") that is not allowed to be deleted.`,
      );
      return false;
    }

    await providerDb.deleteProvider(providerId);
    await providerModelDb.clearProvider(providerId);
    this.removeProviderSnapshot(providerId);
    return true;
  }

  async setProviderActive(providerId: string, isActive: boolean): Promise<void> {
    await this.updateProvider(providerId, { isActive });
  }

  async addModelToProvider(providerId: string, modelName: string): Promise<void> {
    await this.ready();
    const provider =
      this.providerMap.value.get(providerId) ??
      (await this.loadProviderWithModels(providerId));
    if (!provider) {
      return;
    }

    const currentModels = provider.selectedModels || [];
    if (currentModels.includes(modelName)) {
      return;
    }

    await providerModelDb.addModel(providerId, modelName);
    const nextModels = await providerModelDb.getModels(providerId);
    await handleModelListChange(providerId, nextModels);
    this.applyProviderSnapshot({ ...provider, selectedModels: nextModels });
  }

  async removeModelFromProvider(providerId: string, modelName: string): Promise<void> {
    await this.ready();
    const provider =
      this.providerMap.value.get(providerId) ??
      (await this.loadProviderWithModels(providerId));
    if (!provider) {
      return;
    }

    const updatedModels = (provider.selectedModels || []).filter(
      (model) => model !== modelName,
    );
    if (updatedModels.length === provider.selectedModels?.length) {
      return;
    }

    await providerModelDb.removeModel(providerId, modelName);
    const nextModels = await providerModelDb.getModels(providerId);
    await handleModelListChange(providerId, nextModels);
    this.applyProviderSnapshot({ ...provider, selectedModels: nextModels });
  }

  async deleteModelFromAvailable(providerId: string, modelName: string): Promise<void> {
    await this.removeModelFromProvider(providerId, modelName);
  }

  isModelSelectedByProvider(providerId: string, modelName: string): boolean {
    const selected = this.providerModelsMap.value.get(providerId);
    return selected ? selected.includes(modelName) : false;
  }

  getProviderSelectedModels(providerId: string): string[] {
    const selected = this.providerModelsMap.value.get(providerId);
    return selected ? [...selected] : [];
  }
}

const providerService = ProviderService.getInstance();

export function useProviderService(): ProviderService {
  return providerService;
}

export { providerService };
