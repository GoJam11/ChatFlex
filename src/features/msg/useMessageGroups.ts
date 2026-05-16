import type { Msg } from "@/types/msg";

export interface MessageGroup {
    id: string;
    userMessage?: Msg;
    steps: Msg[];
    finalAssistant?: Msg;
    allMessages: Msg[];
}

/**
 * 将扁平消息列表分组为"回复组"（纯函数，无响应式依赖）
 */
export function groupMessages(messages: Msg[]): MessageGroup[] {
    const result: MessageGroup[] = [];
    let current: MessageGroup | null = null;

    for (const msg of messages) {
        if (msg.role === "user") {
            if (current) {
                finalizeGroup(current);
                result.push(current);
            }
            current = {
                id: msg.id,
                userMessage: msg,
                steps: [],
                allMessages: [msg],
            };
        } else {
            if (!current) {
                current = {
                    id: msg.id,
                    steps: [],
                    allMessages: [],
                };
            }
            current.allMessages.push(msg);

            if (msg.role === "tool") {
                current.steps.push(msg);
            } else if (msg.role === "assistant") {
                if (current.finalAssistant) {
                    if (isStepMessage(current.finalAssistant)) {
                        current.steps.push(current.finalAssistant);
                    }
                }
                current.finalAssistant = msg;
            }
        }
    }

    if (current) {
        finalizeGroup(current);
        result.push(current);
    }

    return result;
}

function isStepMessage(msg: Msg): boolean {
    return !!(msg.thinkContent || msg.toolInvocation);
}

function finalizeGroup(group: MessageGroup) {
    if (!group.finalAssistant) return;

    if (group.finalAssistant.thinkContent) {
        group.steps.push(group.finalAssistant);
    }
}
