import { ref } from "vue";
import { toast } from "vue-sonner";
import { ImageDataService } from "@/features/msg/images/imageDataService";

// 待发送图片结构
export interface PendingImage {
    imageId: number;
    previewUrl: string;
    alt?: string;
    mimeType: string;
    file: File;
}

export function usePendingImages() {
    const pendingImages = ref<PendingImage[]>([]);
    const isProcessingImage = ref(false);
    const isDragOver = ref(false);
    const imageService = ImageDataService.getInstance();

    // 创建并触发原生文件选择器
    function openFileSelector() {
        if (isProcessingImage.value) {
            toast.info("正在处理图片，请稍候");
            return;
        }
        // 创建隐藏 input 元素
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;
        input.style.display = "none";
        // 绑定事件
        input.onchange = handleFileSelect;
        // 触发
        document.body.appendChild(input);
        input.click();
        // 选择后移除 input
        input.addEventListener("change", () => {
            setTimeout(() => {
                document.body.removeChild(input);
            }, 100);
        });
    }

    // 处理文件选择
    async function handleFileSelect(event: Event) {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (!files || files.length === 0 || isProcessingImage.value) {
            return;
        }
        await processFiles(Array.from(files));
    }

    // 处理文件列表（通用方法，支持文件选择和拖拽）
    async function processFiles(files: File[]) {
        if (isProcessingImage.value) {
            return;
        }
        isProcessingImage.value = true;
        try {
            for (const file of files) {
                if (!file.type.startsWith("image/")) {
                    toast.error(`文件 "${file.name}" 不是有效的图片文件`);
                    continue;
                }
                // 使用 imageService 添加图片
                const imageId = await imageService.addImage(file);
                const previewUrl = URL.createObjectURL(file);
                pendingImages.value.push({
                    imageId,
                    previewUrl,
                    alt: file.name,
                    mimeType: file.type,
                    file,
                });
            }
        } catch (error) {
            console.error("usePendingImages: 处理图片失败:", error);
            toast.error("处理图片失败，请重试");
        } finally {
            isProcessingImage.value = false;
        }
    }

    // 拖拽事件处理
    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        isDragOver.value = true;
    }

    function handleDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        isDragOver.value = false;
    }

    async function handleDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        isDragOver.value = false;

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) {
            return;
        }

        const imageFiles = Array.from(files).filter(file =>
            file.type.startsWith("image/")
        );

        if (imageFiles.length === 0) {
            toast.error("请拖拽图片文件");
            return;
        }

        await processFiles(imageFiles);
    }

    // 移除待发送图片
    async function removePendingImage(
        imageToRemove: PendingImage,
        index: number
    ) {
        if (index < 0 || index >= pendingImages.value.length) {
            console.error(
                "usePendingImages: Invalid index for removePendingImage",
                index
            );
            return;
        }
        if (pendingImages.value[index].imageId !== imageToRemove.imageId) {
            // 尝试通过 imageId 查找
            const actualIndex = pendingImages.value.findIndex(
                (img) => img.imageId === imageToRemove.imageId
            );
            if (actualIndex === -1) {
                toast.error("无法找到要移除的图片");
                return;
            }
            index = actualIndex;
        }
        try {
            // 使用 imageService 删除图片
            await imageService.deleteImage(imageToRemove.imageId);
            URL.revokeObjectURL(imageToRemove.previewUrl);
            pendingImages.value.splice(index, 1);
        } catch (error) {
            console.error("usePendingImages: 移除图片失败:", error);
            toast.error("移除图片失败，请重试");
        }
    }

    // 清空待发送图片
    function clearPendingImages() {
        pendingImages.value.forEach((img) =>
            URL.revokeObjectURL(img.previewUrl)
        );
        pendingImages.value = [];
    }

    return {
        pendingImages,
        isProcessingImage,
        isDragOver,
        openFileSelector,
        removePendingImage,
        clearPendingImages,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    };
}
