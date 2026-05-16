import { useFileDialog } from "@vueuse/core";
import { useEditAreaStore } from "@/features/send/useEditAreaStore";
import { toast } from "vue-sonner";

export function usePendingAttachment() {
    const editAreaStore = useEditAreaStore();

    const { open: openFileSelector, onChange } = useFileDialog({
        accept: ".md,.markdown",
        multiple: false,
    });

    onChange((files) => {
        if (!files || files.length === 0) {
            return;
        }
        const file = files[0];

        // 验证文件扩展名
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith(".md") && !fileName.endsWith(".markdown")) {
            toast.error("仅支持 Markdown 文件（.md 或 .markdown）");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            editAreaStore.setPendingAttachment({
                name: file.name,
                content,
            });
        };
        reader.readAsText(file);
    });

    const removePendingAttachment = () => {
        editAreaStore.setPendingAttachment(null);
    };

    const clearPendingAttachment = () => {
        editAreaStore.setPendingAttachment(null);
    };

    return {
        openFileSelector,
        removePendingAttachment,
        clearPendingAttachment,
    };
}
