import { useRouter } from "vue-router";
import { nextTick } from "vue";
import { isMacPlatform } from "@/utils/platform";

export interface NewChatShortcutOptions {
    /** Whether the shortcut is enabled */
    enabled?: boolean;
    /** Custom callback to execute before navigation */
    beforeNavigate?: () => void | Promise<void>;
    /** Custom callback to execute after navigation for focus management */
    afterNavigate?: () => void | Promise<void>;
}

export interface NewChatShortcutReturn {
    /** Handle keyboard events */
    handleKeyDown: (event: KeyboardEvent) => void;
    /** Navigate to new chat programmatically */
    navigateToNewChat: () => Promise<void>;
    /** Check if element should be excluded from shortcut handling */
    shouldExcludeElement: (element: HTMLElement) => boolean;
}

/**
 * Composable for handling new chat keyboard shortcuts
 * Supports Cmd+N on macOS and Ctrl+N on Windows/Linux
 */
export function useNewChatShortcut(
    options: NewChatShortcutOptions = {},
): NewChatShortcutReturn {
    const { enabled = true, beforeNavigate, afterNavigate } = options;
    const router = useRouter();
    const isMacOS = isMacPlatform;

    /**
     * Check if an element should be excluded from shortcut handling
     * This includes input elements, contenteditable elements, and elements with specific roles
     */
    function shouldExcludeElement(element: HTMLElement): boolean {
        if (!element) return false;

        // Check for input elements
        const isInputElement =
            element.tagName === "INPUT" ||
            element.tagName === "TEXTAREA" ||
            element.contentEditable === "true" ||
            element.getAttribute("contenteditable") === "true";

        // Check for elements that might be inside contenteditable containers
        const isInContentEditable =
            element.closest('[contenteditable="true"]') !== null;

        // Check for elements with input-like roles
        const hasInputRole =
            element.getAttribute("role") === "textbox" ||
            element.getAttribute("role") === "searchbox" ||
            element.getAttribute("role") === "combobox";

        // Check for elements that are part of dropdown menus or modals that might need keyboard navigation
        const isInDropdown =
            element.closest('[role="menu"]') !== null ||
            element.closest('[role="listbox"]') !== null ||
            element.closest('[role="dialog"]') !== null ||
            element.closest("[data-radix-dropdown-content]") !== null ||
            element.closest("[data-radix-select-content]") !== null ||
            element.closest("[data-radix-dialog-content]") !== null;

        // Check for elements that are part of the EditArea keyboard handlers
        const isInEditArea =
            element.closest(".editarea-input-container-border") !== null;

        return (
            isInputElement ||
            isInContentEditable ||
            hasInputRole ||
            isInDropdown ||
            isInEditArea
        );
    }

    /**
     * Navigate to new chat programmatically with enhanced focus management
     */
    async function navigateToNewChat(): Promise<void> {
        try {
            // Execute beforeNavigate callback if provided
            if (beforeNavigate) {
                await beforeNavigate();
            }

            // Navigate to root path which triggers new chat state
            await router.push("/");

            // Wait for DOM updates and then handle focus management
            await nextTick();

            // Execute afterNavigate callback if provided (for custom focus management)
            if (afterNavigate) {
                await afterNavigate();
            } else {
                // Default focus management: rely on EditArea's useInputFocus composable
                // which automatically focuses the input when the route changes
                console.log(
                    "[useNewChatShortcut] Navigation completed, relying on EditArea's focus management",
                );
            }
        } catch (error) {
            console.error("[useNewChatShortcut] Navigation failed:", error);
            // Optionally, you could emit an event or show a toast notification here
            throw error;
        }
    }

    /**
     * Handle keyboard events for new chat shortcut with enhanced conflict prevention
     */
    function handleKeyDown(event: KeyboardEvent): void {
        if (!enabled) {
            return;
        }

        // Check if this is the new chat shortcut
        const isNewChatShortcut = event.key === "n" || event.key === "N";
        const hasCorrectModifier = isMacOS
            ? event.metaKey && !event.ctrlKey
            : event.ctrlKey && !event.metaKey;
        const hasNoOtherModifiers = !event.altKey && !event.shiftKey;

        if (isNewChatShortcut && hasCorrectModifier && hasNoOtherModifiers) {
            const target = event.target as HTMLElement;

            // Use enhanced element exclusion logic
            if (shouldExcludeElement(target)) {
                console.log(
                    "[useNewChatShortcut] Shortcut ignored - target element excluded:",
                    target.tagName,
                    target.className,
                );
                return;
            }

            // Additional check: don't interfere if there's an active selection that might be part of text editing
            const selection = window.getSelection();
            if (
                selection &&
                !selection.isCollapsed &&
                selection.toString().trim()
            ) {
                console.log(
                    "[useNewChatShortcut] Shortcut ignored - active text selection detected",
                );
                return;
            }

            // Prevent default browser behavior
            event.preventDefault();
            event.stopPropagation();

            console.log(
                "[useNewChatShortcut] Shortcut triggered - navigating to new chat",
            );

            // Navigate to new chat
            navigateToNewChat().catch((error) => {
                console.error(
                    "[useNewChatShortcut] Failed to navigate to new chat:",
                    error,
                );
            });
        }
    }

    return {
        handleKeyDown,
        navigateToNewChat,
        shouldExcludeElement,
    };
}
