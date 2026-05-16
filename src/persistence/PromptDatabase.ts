import { v4 as uuid } from 'uuid';
import { chatFlexDb } from './chatflex-db';
import type { Prompt } from '@/types/prompt';
import { withTimeout } from '@/utils/timeout';

const promptTable = chatFlexDb.prompts;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

export class PromptDatabase {
  get prompts() {
    return promptTable;
  }

  async getAllPrompts(): Promise<Prompt[]> {
    try {
      return await withTimeout(
        promptTable.orderBy('updatedAt').reverse().toArray(),
        { timeout: 10000, timeoutMessage: '获取提示词列表超时' },
      );
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error));
    }
  }

  async createPrompt(data: { title: string; content: string }): Promise<Prompt> {
    const now = Date.now();
    const prompt: Prompt = {
      id: uuid(),
      title: data.title,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await withTimeout(
        promptTable.put(prompt),
        { timeout: 10000, timeoutMessage: '创建提示词超时' },
      );
      return prompt;
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error));
    }
  }

  async updatePrompt(id: string, changes: { title?: string; content?: string }): Promise<Prompt | null> {
    try {
      const existing = await withTimeout(
        promptTable.get(id),
        { timeout: 8000, timeoutMessage: '查询提示词超时' },
      );

      if (!existing) {
        return null;
      }

      const updatedPrompt: Prompt = {
        ...existing,
        ...changes,
        updatedAt: Date.now(),
      };

      await withTimeout(
        promptTable.put(updatedPrompt),
        { timeout: 10000, timeoutMessage: '更新提示词超时' },
      );

      return updatedPrompt;
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error));
    }
  }

  async deletePrompt(id: string): Promise<void> {
    try {
      await withTimeout(
        promptTable.delete(id),
        { timeout: 8000, timeoutMessage: '删除提示词超时' },
      );
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const promptDb = new PromptDatabase();
