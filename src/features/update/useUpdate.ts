import { onMounted } from 'vue'
import { useEnvStore } from '@/features/app/useEnvStore.ts'
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater'

// 单例标志，确保只初始化一次
let isInitialized = false
let updateCheckInterval: ReturnType<typeof setInterval> | null = null
let activeUpdate: Update | null = null

const handleDownloadEvent = (() => {
    let total = 0
    let transferred = 0
    let lastSampleTime = 0
    let lastSampleTransferred = 0

    return (event: DownloadEvent) => {
        if (event.event === 'Started') {
            total = event.data.contentLength ?? 0
            transferred = 0
            lastSampleTime = Date.now()
            lastSampleTransferred = 0
            return
        }

        if (event.event === 'Progress') {
            transferred += event.data.chunkLength
            const now = Date.now()
            const elapsedSec = (now - lastSampleTime) / 1000
            const delta = transferred - lastSampleTransferred
            const bytesPerSecond = elapsedSec > 0 ? delta / elapsedSec : 0
            lastSampleTime = now
            lastSampleTransferred = transferred
            const percent = total > 0 ? (transferred / total) * 100 : 0
            console.log(`[Update] Download progress: ${percent.toFixed(1)}% (${bytesPerSecond.toFixed(0)} B/s)`)
            return
        }

        if (event.event === 'Finished') {
            console.log('[Update] Download finished')
        }
    }
})()

export function useUpdate() {
    const envStore = useEnvStore()

    const isUpdateEnabled = () => {
        if (envStore.autoUpdateDisabled) {
            console.log('[Update] Auto-update disabled via environment configuration')
            return false
        }
        if (!envStore.isElectronEnv) {
            console.log('Non-desktop environment detected, skipping auto-update')
            return false
        }
        if (envStore.isMobile) {
            console.log('Mobile platform detected, skipping auto-update')
            return false
        }
        return true
    }

    // 检查并安装已下载的更新
    const checkAndInstallDownloadedUpdate = async (): Promise<boolean> => {
        if (!isUpdateEnabled()) {
            clearUpdateState()
            return false
        }

        if (envStore.updateDownloaded && envStore.updateInfo.version) {
            console.log(`Found downloaded update ${envStore.updateInfo.version}, ready to install`)
            return true
        }

        return false
    }

    // 检查并下载更新
    const checkAndDownloadUpdate = async (): Promise<void> => {
        if (!isUpdateEnabled()) {
            return
        }

        if (envStore.updateDownloaded) {
            console.log('Update already downloaded, skipping check')
            return
        }

        try {
            console.info('[Update] Checking for updates...')
            const update = await check()
            if (!update) {
                envStore.updateAvailable = false
                return
            }

            activeUpdate = update
            envStore.updateAvailable = true
            envStore.updateInfo = {
                version: update.version,
                notes: update.body ?? '',
                date: update.date ?? '',
            }

            await update.download(handleDownloadEvent)
            envStore.updateDownloaded = true
        } catch (error) {
            console.error('Failed to check or download update:', error)
            envStore.updateAvailable = false
            envStore.updateDownloaded = false
        }
    }

    // 安装更新
    const installUpdate = async (): Promise<void> => {
        if (!isUpdateEnabled()) {
            throw new Error('Update installation not supported in this environment')
        }

        try {
            envStore.updateInstalling = true

            if (!activeUpdate) {
                const update = await check()
                if (!update) {
                    throw new Error('No update available')
                }
                activeUpdate = update
                envStore.updateAvailable = true
                envStore.updateInfo = {
                    version: update.version,
                    notes: update.body ?? '',
                    date: update.date ?? '',
                }

                if (!envStore.updateDownloaded) {
                    await update.download(handleDownloadEvent)
                    envStore.updateDownloaded = true
                }
            }

            await activeUpdate.install()
        } catch (error) {
            console.error('Failed to install update:', error)
            envStore.updateInstalling = false
            throw error
        } finally {
            if (activeUpdate) {
                try {
                    await activeUpdate.close()
                } catch {
                    // ignore
                }
                activeUpdate = null
            }
        }
    }

    // 清除更新状态的辅助函数
    function clearUpdateState(): void {
        envStore.updateDownloaded = false
        envStore.updateAvailable = false
        envStore.updateInfo = { version: '', notes: '', date: '' }
        envStore.updateDownloadPath = ''
    }

    // 初始化更新检查
    const initializeUpdateCheck = async (): Promise<void> => {
        if (isUpdateEnabled()) {
            const hasDownloadedUpdate = await checkAndInstallDownloadedUpdate()

            if (!hasDownloadedUpdate) {
                checkAndDownloadUpdate()
            }

            updateCheckInterval = setInterval(() => {
                checkAndDownloadUpdate()
            }, 2 * 60 * 60 * 1000)
        }
    }

    // 清理定时器
    const cleanup = (): void => {
        if (updateCheckInterval !== null) {
            clearInterval(updateCheckInterval)
            updateCheckInterval = null
        }
    }

    onMounted(() => {
        if (!isInitialized) {
            isInitialized = true
            initializeUpdateCheck()
        }
    })

    return {
        initializeUpdateCheck,
        checkAndDownloadUpdate,
        installUpdate,
        cleanup,
        checkAndInstallDownloadedUpdate,
        clearUpdateState
    }
}
