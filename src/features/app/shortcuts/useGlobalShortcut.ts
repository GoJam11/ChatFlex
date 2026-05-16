import { ref, watch } from 'vue'
import { useSettingStore } from '@/features/setting/useSettingStore'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isRegistered, register, unregisterAll } from '@tauri-apps/plugin-global-shortcut'

export function useGlobalShortcut() {
    const settingStore = useSettingStore()
    const isRegisteredState = ref(false)
    const error = ref('')

    const isElectronEnv = typeof window !== 'undefined' && isTauri()

    const toggleWindowVisibility = async () => {
        const appWindow = getCurrentWindow()
        const visible = await appWindow.isVisible()
        if (visible) {
            await appWindow.hide()
            return
        }

        const minimized = await appWindow.isMinimized()
        if (minimized) {
            await appWindow.unminimize()
        }
        await appWindow.show()
        await appWindow.setFocus()
    }

    // 注册全局快捷键
    async function registerShortcut(shortcut: string): Promise<boolean> {
        if (!isElectronEnv) {
            console.warn('[Global Shortcut] Not in Tauri environment, cannot register shortcut')
            return false
        }

        try {
            console.log('[Global Shortcut] Registering:', shortcut)

            // 先取消注册所有快捷键
            await unregisterAll()

            // 注册新快捷键
            await register(shortcut, async event => {
                if (event.state === 'Pressed') {
                    try {
                        await toggleWindowVisibility()
                    } catch (toggleError) {
                        console.warn('[Global Shortcut] Toggle failed:', toggleError)
                    }
                }
            })

            const registered = await isRegistered(shortcut)
            if (!registered) {
                throw new Error('Global shortcut registration failed')
            }

            isRegisteredState.value = true
            error.value = ''
            console.log('[Global Shortcut] Successfully registered:', shortcut)
            return true
        } catch (err) {
            console.error('[Global Shortcut] Failed to register:', err)
            error.value = `注册失败: ${err}`
            isRegisteredState.value = false
            return false
        }
    }

    // 取消注册全局快捷键
    async function unregisterShortcut(): Promise<boolean> {
        if (!isElectronEnv) {
            console.warn('[Global Shortcut] Not in Tauri environment, cannot unregister shortcut')
            return false
        }

        try {
            console.log('[Global Shortcut] Unregistering all shortcuts')
            await unregisterAll()
            isRegisteredState.value = false
            error.value = ''
            console.log('[Global Shortcut] Successfully unregistered all shortcuts')
            return true
        } catch (err) {
            console.error('[Global Shortcut] Failed to unregister:', err)
            error.value = `取消注册失败: ${err}`
            return false
        }
    }

    // 更新快捷键
    async function updateShortcut(shortcut: string): Promise<boolean> {
        if (settingStore.enableGlobalShortcut) {
            return await registerShortcut(shortcut)
        }
        return true
    }

    // 切换快捷键启用状态
    async function toggleShortcut(enabled: boolean): Promise<boolean> {
        if (enabled) {
            return await registerShortcut(settingStore.globalShortcut)
        }
        return await unregisterShortcut()
    }

    // 监听快捷键设置变化
    watch(() => settingStore.globalShortcut, async (newShortcut) => {
        if (settingStore.enableGlobalShortcut && newShortcut) {
            await updateShortcut(newShortcut)
        }
    })

    // 监听启用状态变化
    watch(() => settingStore.enableGlobalShortcut, async (enabled) => {
        await toggleShortcut(enabled)
    })

    return {
        isRegistered: isRegisteredState,
        error,
        registerShortcut,
        unregisterShortcut,
        updateShortcut,
        toggleShortcut
    }
}
