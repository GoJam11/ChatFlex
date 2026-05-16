import { ref } from 'vue'
import { OllamaManageService } from '@/features/ollama/ollamaManageService'
import { toast } from 'vue-sonner'
import { useProviderService } from '@/features/provider/providerService'

export function useOllamaModelManager() {
  const providerService = useProviderService()

  const isRefreshingLocal = ref(false)
  const connectionError = ref<string | null>(null)

  const getOllamaManageService = async (): Promise<OllamaManageService | null> => {
    try {
      await providerService.ready()
      const provider = providerService.getProvider('ollama')
      if (!provider || !provider.baseUrl) {
        connectionError.value = 'Ollama配置不完整，请先配置Ollama服务地址'
        toast.error(connectionError.value)
        return null
      }

      connectionError.value = null
      return new OllamaManageService({
        baseURL: provider.baseUrl,
        apiKey: provider.apiKey || '',
      })
    } catch (error: any) {
      const errorMsg = `创建Ollama管理服务失败: ${error.message || error}`
      connectionError.value = errorMsg
      console.error('[useOllamaModelManager] getOllamaManageService error:', error)
      toast.error(errorMsg)
      return null
    }
  }

  const getLocalModels = (): string[] => {
    return providerService.getProviderSelectedModels('ollama')
  }

  const refreshLocalModels = async () => {
    const ollamaManageService = await getOllamaManageService()
    if (!ollamaManageService) return

    isRefreshingLocal.value = true
    try {
      console.log('[useOllamaModelManager] 开始刷新本地模型列表')
      const models = await ollamaManageService.getModels()

      const currentSelectedModels = providerService.getProviderSelectedModels('ollama')
      const newModels = models.filter((model: any) => !currentSelectedModels.includes(model))
      for (const model of newModels) {
        await providerService.addModelToProvider('ollama', model)
      }

      const removedModels = currentSelectedModels.filter((model: any) => !models.includes(model))
      for (const model of removedModels) {
        await providerService.removeModelFromProvider('ollama', model)
      }

      console.log(`[useOllamaModelManager] 刷新完成: 新增${newModels.length}个模型, 移除${removedModels.length}个模型`)

      if (newModels.length > 0) {
        toast.success(`发现 ${newModels.length} 个新模型`)
      }
      if (removedModels.length > 0) {
        toast.info(`移除 ${removedModels.length} 个已删除的模型`)
      }

      connectionError.value = null
    } catch (error: any) {
      const errorMsg = `刷新本地模型失败: ${error.message || error}`
      connectionError.value = errorMsg
      console.error('[useOllamaModelManager] refreshLocalModels error:', error)
      toast.error(errorMsg)
    } finally {
      isRefreshingLocal.value = false
    }
  }

  const checkOllamaConnection = async (): Promise<boolean> => {
    const ollamaManageService = await getOllamaManageService()
    if (!ollamaManageService) return false

    try {
      await ollamaManageService.getModels()
      connectionError.value = null
      return true
    } catch (error: any) {
      const errorMsg = `Ollama服务连接失败: ${error.message || error}`
      connectionError.value = errorMsg
      console.warn('[useOllamaModelManager] checkConnection failed:', error)
      return false
    }
  }

  return {
    isRefreshingLocal,
    connectionError,

    getLocalModels,
    refreshLocalModels,
    checkOllamaConnection
  }
}
