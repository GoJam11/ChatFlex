/**
 * send 模块核心功能测试
 *
 * 包含两部分：
 * 1. 纯函数单元测试（不依赖外部服务）
 * 2. 可选集成测试（使用本机 Ollama 验证端到端流程）
 */

import { describe, it, expect } from 'vitest';
import {
  streamText,
  convertToModelMessages,
  type ModelMessage,
  type UIMessage,
} from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { MessageStatus } from '@/types/msg';
import type { MessageRecord } from '@/types/msg';
import {
  extractTextSegments,
  deriveStatusFromSegment,
  stringifyForDisplay,
  toToolResultOutput,
  isToolResultOutput,
  buildToolMessageContent,
  buildToolModelMessage,
  mapToolRecordToModelMessage,
  buildModelMessages,
  mergeSystemPrompts,
  getKnowledgeBaseFolderName,
  type TextSegment,
  type ToolMessageSnapshot,
} from './sendUtils';

// ==================== 1. 纯函数单元测试 ====================

describe('stringifyForDisplay', () => {
  it('null/undefined 返回空字符串', () => {
    expect(stringifyForDisplay(null)).toBe('');
    expect(stringifyForDisplay(undefined)).toBe('');
  });

  it('字符串原样返回', () => {
    expect(stringifyForDisplay('hello')).toBe('hello');
  });

  it('对象 JSON 格式化', () => {
    expect(stringifyForDisplay({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('数字转字符串', () => {
    expect(stringifyForDisplay(42)).toBe('42');
  });
});

describe('isToolResultOutput / toToolResultOutput', () => {
  it('识别合法的 ToolResultOutput', () => {
    expect(isToolResultOutput({ type: 'text', value: 'hi' })).toBe(true);
    expect(isToolResultOutput({ type: 'json', value: {} })).toBe(true);
  });

  it('拒绝非法值', () => {
    expect(isToolResultOutput(null)).toBe(false);
    expect(isToolResultOutput('string')).toBe(false);
    expect(isToolResultOutput({ noType: true })).toBe(false);
  });

  it('toToolResultOutput 传入合法值原样返回', () => {
    const valid = { type: 'text' as const, value: 'hi' };
    expect(toToolResultOutput(valid)).toBe(valid);
  });

  it('toToolResultOutput 传入非法值包装为 text', () => {
    const result = toToolResultOutput('raw string');
    expect(result).toEqual({ type: 'text', value: 'raw string' });
  });

  it('toToolResultOutput 传入对象包装为 JSON 字符串', () => {
    const result = toToolResultOutput({ key: 'val' });
    expect(result.type).toBe('text');
    expect((result as { value: string }).value).toContain('"key"');
  });
});

describe('extractTextSegments', () => {
  it('纯文本消息返回单个段', () => {
    const parts: UIMessage['parts'] = [
      { type: 'text', text: 'Hello world', state: 'done' },
    ];
    const segments = extractTextSegments(parts);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe('Hello world');
    expect(segments[0].reasoning).toBe('');
    expect(segments[0].streaming).toBe(false);
  });

  it('文本 + 工具 + 文本 产生两个段', () => {
    const parts: UIMessage['parts'] = [
      { type: 'text', text: 'Before tool', state: 'done' },
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'tc1',
          toolName: 'test',
          state: 'result',
          args: {},
          result: 'ok',
        },
      } as unknown as UIMessage['parts'][number],
      { type: 'text', text: 'After tool', state: 'done' },
    ];
    const segments = extractTextSegments(parts);
    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe('Before tool');
    expect(segments[1].text).toBe('After tool');
  });

  it('多个工具调用产生多个段', () => {
    const parts: UIMessage['parts'] = [
      { type: 'text', text: 'Seg0', state: 'done' },
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'tc1',
          toolName: 'a',
          state: 'result',
          args: {},
          result: 'r1',
        },
      } as unknown as UIMessage['parts'][number],
      { type: 'text', text: 'Seg1', state: 'done' },
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'tc2',
          toolName: 'b',
          state: 'result',
          args: {},
          result: 'r2',
        },
      } as unknown as UIMessage['parts'][number],
      { type: 'text', text: 'Seg2', state: 'done' },
    ];
    const segments = extractTextSegments(parts);
    expect(segments).toHaveLength(3);
    expect(segments[0].text).toBe('Seg0');
    expect(segments[1].text).toBe('Seg1');
    expect(segments[2].text).toBe('Seg2');
  });

  it('推理内容正确归到对应段', () => {
    const parts: UIMessage['parts'] = [
      { type: 'reasoning', text: 'thinking...', state: 'done' },
      { type: 'text', text: 'Answer', state: 'done' },
    ];
    const segments = extractTextSegments(parts);
    expect(segments).toHaveLength(1);
    expect(segments[0].reasoning).toBe('thinking...');
    expect(segments[0].text).toBe('Answer');
  });

  it('streaming 状态正确传递', () => {
    const parts: UIMessage['parts'] = [
      { type: 'text', text: 'partial', state: 'streaming' },
    ];
    const segments = extractTextSegments(parts);
    expect(segments[0].streaming).toBe(true);
  });

  it('空 parts 返回一个空段', () => {
    const segments = extractTextSegments([]);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe('');
    expect(segments[0].reasoning).toBe('');
  });
});

describe('deriveStatusFromSegment', () => {
  it('isFinal=true 始终返回 COMPLETED', () => {
    const seg: TextSegment = { text: '', reasoning: '', streaming: true };
    expect(deriveStatusFromSegment(seg, true)).toBe(MessageStatus.COMPLETED);
  });

  it('有文本且 streaming 返回 GENERATING', () => {
    const seg: TextSegment = { text: 'hello', reasoning: '', streaming: true };
    expect(deriveStatusFromSegment(seg, false)).toBe(MessageStatus.GENERATING);
  });

  it('有文本且非 streaming 返回 COMPLETED', () => {
    const seg: TextSegment = { text: 'hello', reasoning: '', streaming: false };
    expect(deriveStatusFromSegment(seg, false)).toBe(MessageStatus.COMPLETED);
  });

  it('仅推理内容返回 THINKING', () => {
    const seg: TextSegment = { text: '', reasoning: 'think', streaming: false };
    expect(deriveStatusFromSegment(seg, false)).toBe(MessageStatus.THINKING);
  });

  it('空内容但 streaming 返回 GENERATING', () => {
    const seg: TextSegment = { text: '', reasoning: '', streaming: true };
    expect(deriveStatusFromSegment(seg, false)).toBe(MessageStatus.GENERATING);
  });

  it('空内容非 streaming 返回 WAITING', () => {
    const seg: TextSegment = { text: '', reasoning: '', streaming: false };
    expect(deriveStatusFromSegment(seg, false)).toBe(MessageStatus.WAITING);
  });
});

describe('buildToolMessageContent', () => {
  it('基本工具消息格式正确', () => {
    const snapshot: ToolMessageSnapshot = {
      toolCallId: 'call-1',
      toolName: 'fetchWeb',
    };
    const content = buildToolMessageContent(snapshot);
    expect(content).toContain('**Tool**: fetchWeb');
    expect(content).toContain('**Call ID**: call-1');
  });

  it('包含 input/output', () => {
    const snapshot: ToolMessageSnapshot = {
      toolCallId: 'call-2',
      toolName: 'search',
      input: { query: 'test' },
      output: { results: [] },
    };
    const content = buildToolMessageContent(snapshot);
    expect(content).toContain('#### Input');
    expect(content).toContain('"query"');
    expect(content).toContain('#### Output');
    expect(content).toContain('"results"');
  });

  it('包含 title 和 providerExecuted', () => {
    const snapshot: ToolMessageSnapshot = {
      toolCallId: 'call-3',
      toolName: 'tool',
      title: 'My Title',
      providerExecuted: true,
    };
    const content = buildToolMessageContent(snapshot);
    expect(content).toContain('**Summary**: My Title');
    expect(content).toContain('**Executed by provider**: Yes');
  });
});

describe('buildToolModelMessage', () => {
  it('生成正确的 ToolModelMessage 结构', () => {
    const snapshot: ToolMessageSnapshot = {
      toolCallId: 'tc-1',
      toolName: 'myTool',
      output: 'result text',
    };
    const msg = buildToolModelMessage(snapshot);
    expect(msg.role).toBe('tool');
    expect(msg.content).toHaveLength(1);
    expect(msg.content[0].type).toBe('tool-result');
    expect((msg.content[0] as any).toolCallId).toBe('tc-1');
    expect((msg.content[0] as any).toolName).toBe('myTool');
  });
});

describe('mapToolRecordToModelMessage', () => {
  it('从 messages 字段提取 tool message', () => {
    const record: MessageRecord = {
      id: 'msg-1',
      chatId: 'chat-1',
      content: '',
      short: '',
      role: 'tool',
      timestamp: Date.now(),
      status: MessageStatus.COMPLETED,
      messages: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'tc-1',
              toolName: 'test',
              output: { type: 'text', value: 'ok' },
            },
          ],
        },
      ],
    };
    const result = mapToolRecordToModelMessage(record);
    expect(result).not.toBeNull();
    expect(result!.role).toBe('tool');
    expect((result!.content[0] as any).toolCallId).toBe('tc-1');
  });

  it('从 toolInvocation 回退构建', () => {
    const record: MessageRecord = {
      id: 'msg-2',
      chatId: 'chat-1',
      content: 'fallback output',
      short: '',
      role: 'tool',
      timestamp: Date.now(),
      status: MessageStatus.COMPLETED,
      toolInvocation: {
        toolCallId: 'tc-2',
        toolName: 'fallbackTool',
      },
    };
    const result = mapToolRecordToModelMessage(record);
    expect(result).not.toBeNull();
    expect((result!.content[0] as any).toolCallId).toBe('tc-2');
    expect((result!.content[0] as any).toolName).toBe('fallbackTool');
  });

  it('无 messages 且无 toolInvocation 返回 null', () => {
    const record: MessageRecord = {
      id: 'msg-3',
      chatId: 'chat-1',
      content: '',
      short: '',
      role: 'tool',
      timestamp: Date.now(),
      status: MessageStatus.COMPLETED,
    };
    const result = mapToolRecordToModelMessage(record);
    expect(result).toBeNull();
  });
});

describe('buildModelMessages - 消息历史重建', () => {
  // 这是修复 400 错误的核心逻辑

  it('纯用户+助手消息不做修改', () => {
    const records: MessageRecord[] = [
      {
        id: 'u1', chatId: 'c1', content: 'Hello', short: 'Hello',
        role: 'user', timestamp: 1, status: MessageStatus.COMPLETED,
      },
      {
        id: 'a1', chatId: 'c1', content: 'Hi there', short: 'Hi',
        role: 'assistant', timestamp: 2, status: MessageStatus.COMPLETED,
      },
    ];
    const converted: ModelMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Hi there' }] },
    ];

    const result = buildModelMessages(records, converted);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
  });

  it('assistant 后跟 tool 记录时注入 tool-call parts', () => {
    const records: MessageRecord[] = [
      {
        id: 'u1', chatId: 'c1', content: 'Search something', short: '',
        role: 'user', timestamp: 1, status: MessageStatus.COMPLETED,
      },
      {
        id: 'a1', chatId: 'c1', content: 'Let me search', short: '',
        role: 'assistant', timestamp: 2, status: MessageStatus.COMPLETED,
      },
      {
        id: 't1', chatId: 'c1', content: 'search result', short: '',
        role: 'tool', timestamp: 3, status: MessageStatus.COMPLETED,
        toolInvocation: {
          toolCallId: 'tc-1',
          toolName: 'search',
          input: { query: 'test' },
          output: { type: 'text', value: 'found it' },
        },
      },
    ];
    // convertToModelMessages 只处理 non-tool 记录
    const converted: ModelMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Search something' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Let me search' }] },
    ];

    const result = buildModelMessages(records, converted);

    // 应该是: user, assistant(with tool-call), tool
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('tool');

    // 验证 assistant 消息包含 tool-call part
    const assistantContent = result[1].content;
    expect(Array.isArray(assistantContent)).toBe(true);
    const contentArray = assistantContent as unknown[];
    const toolCallPart = contentArray.find(
      (p: any) => p.type === 'tool-call'
    ) as any;
    expect(toolCallPart).toBeDefined();
    expect(toolCallPart.toolCallId).toBe('tc-1');
    expect(toolCallPart.toolName).toBe('search');
    expect(toolCallPart.input).toEqual({ query: 'test' });
  });

  it('assistant 后跟多个 tool 记录时注入多个 tool-call parts', () => {
    const records: MessageRecord[] = [
      {
        id: 'u1', chatId: 'c1', content: 'Do tasks', short: '',
        role: 'user', timestamp: 1, status: MessageStatus.COMPLETED,
      },
      {
        id: 'a1', chatId: 'c1', content: '', short: '',
        role: 'assistant', timestamp: 2, status: MessageStatus.COMPLETED,
      },
      {
        id: 't1', chatId: 'c1', content: '', short: '',
        role: 'tool', timestamp: 3, status: MessageStatus.COMPLETED,
        toolInvocation: { toolCallId: 'tc-1', toolName: 'toolA', input: { x: 1 } },
      },
      {
        id: 't2', chatId: 'c1', content: '', short: '',
        role: 'tool', timestamp: 4, status: MessageStatus.COMPLETED,
        toolInvocation: { toolCallId: 'tc-2', toolName: 'toolB', input: { y: 2 } },
      },
    ];
    const converted: ModelMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Do tasks' }] },
      { role: 'assistant', content: '' },
    ];

    const result = buildModelMessages(records, converted);

    expect(result).toHaveLength(4); // user, assistant, tool, tool
    const assistantContent = result[1].content as unknown[];
    expect(Array.isArray(assistantContent)).toBe(true);
    const toolCalls = (assistantContent as any[]).filter((p: any) => p.type === 'tool-call');
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].toolCallId).toBe('tc-1');
    expect(toolCalls[1].toolCallId).toBe('tc-2');
  });

  it('多轮对话：assistant+tool, assistant+tool, assistant 最终回复', () => {
    const records: MessageRecord[] = [
      {
        id: 'u1', chatId: 'c1', content: 'Question', short: '',
        role: 'user', timestamp: 1, status: MessageStatus.COMPLETED,
      },
      {
        id: 'a1', chatId: 'c1', content: 'Step 1', short: '',
        role: 'assistant', timestamp: 2, status: MessageStatus.COMPLETED,
      },
      {
        id: 't1', chatId: 'c1', content: '', short: '',
        role: 'tool', timestamp: 3, status: MessageStatus.COMPLETED,
        toolInvocation: { toolCallId: 'tc-1', toolName: 'search' },
      },
      {
        id: 'a2', chatId: 'c1', content: 'Step 2', short: '',
        role: 'assistant', timestamp: 4, status: MessageStatus.COMPLETED,
      },
      {
        id: 't2', chatId: 'c1', content: '', short: '',
        role: 'tool', timestamp: 5, status: MessageStatus.COMPLETED,
        toolInvocation: { toolCallId: 'tc-2', toolName: 'fetch' },
      },
      {
        id: 'a3', chatId: 'c1', content: 'Final answer', short: '',
        role: 'assistant', timestamp: 6, status: MessageStatus.COMPLETED,
      },
    ];
    const converted: ModelMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Question' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Step 1' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Step 2' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Final answer' }] },
    ];

    const result = buildModelMessages(records, converted);

    // user, assistant(+tc), tool, assistant(+tc), tool, assistant
    expect(result).toHaveLength(6);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('tool');
    expect(result[3].role).toBe('assistant');
    expect(result[4].role).toBe('tool');
    expect(result[5].role).toBe('assistant');

    // 第一个 assistant 有 tool-call
    const a1Content = result[1].content as any[];
    expect(a1Content.some((p: any) => p.type === 'tool-call' && p.toolCallId === 'tc-1')).toBe(true);

    // 第二个 assistant 有 tool-call
    const a2Content = result[3].content as any[];
    expect(a2Content.some((p: any) => p.type === 'tool-call' && p.toolCallId === 'tc-2')).toBe(true);

    // 最后一个 assistant 没有 tool-call（纯文本）
    const a3Content = result[5].content;
    if (Array.isArray(a3Content)) {
      expect(a3Content.every((p: any) => p.type !== 'tool-call')).toBe(true);
    }
  });

  it('assistant 空内容后跟 tool 不生成空 text part', () => {
    const records: MessageRecord[] = [
      {
        id: 'u1', chatId: 'c1', content: 'Q', short: '',
        role: 'user', timestamp: 1, status: MessageStatus.COMPLETED,
      },
      {
        id: 'a1', chatId: 'c1', content: '', short: '',
        role: 'assistant', timestamp: 2, status: MessageStatus.COMPLETED,
      },
      {
        id: 't1', chatId: 'c1', content: '', short: '',
        role: 'tool', timestamp: 3, status: MessageStatus.COMPLETED,
        toolInvocation: { toolCallId: 'tc-1', toolName: 'x', input: {} },
      },
    ];
    const converted: ModelMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Q' }] },
      { role: 'assistant', content: '' },
    ];

    const result = buildModelMessages(records, converted);
    const assistantContent = result[1].content as any[];

    // 只有 tool-call，没有空 text part
    expect(assistantContent.every((p: any) => p.type === 'tool-call')).toBe(true);
  });
});

describe('mergeSystemPrompts', () => {
  it('两个都有值时合并', () => {
    expect(mergeSystemPrompts('base', 'kb')).toBe('base\n\nkb');
  });

  it('只有 base 返回 base', () => {
    expect(mergeSystemPrompts('base', undefined)).toBe('base');
  });

  it('只有 kb 返回 kb', () => {
    expect(mergeSystemPrompts(undefined, 'kb')).toBe('kb');
  });

  it('都没有返回 undefined', () => {
    expect(mergeSystemPrompts(undefined, undefined)).toBeUndefined();
  });

  it('空白字符串视为空', () => {
    expect(mergeSystemPrompts('  ', '  ')).toBeUndefined();
  });
});

describe('getKnowledgeBaseFolderName', () => {
  it('提取路径最后一段', () => {
    expect(getKnowledgeBaseFolderName('/path/to/docs')).toBe('docs');
  });

  it('处理末尾斜杠', () => {
    expect(getKnowledgeBaseFolderName('/path/to/docs/')).toBe('docs');
  });

  it('处理 Windows 路径', () => {
    expect(getKnowledgeBaseFolderName('C:\\Users\\docs')).toBe('docs');
  });

  it('空字符串返回空', () => {
    expect(getKnowledgeBaseFolderName('')).toBe('');
  });
});

// ==================== 2. 可选集成测试 (本机 Ollama) ====================

const runOllamaIntegration = process.env.RUN_OLLAMA_INTEGRATION === 'true';
const ollamaTestModel = process.env.OLLAMA_TEST_MODEL ?? 'gpt-oss:latest';
const ollamaBaseURL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/api';
const describeOllamaIntegration = runOllamaIntegration ? describe : describe.skip;

describeOllamaIntegration('ollama 集成测试', { timeout: 120_000 }, () => {
  const ollama = createOllama({
    baseURL: ollamaBaseURL,
  });

  it('基础对话：发送消息并获取文本回复', async () => {
    const model = ollama(ollamaTestModel);

    const result = streamText({
      model,
      messages: [
        { role: 'user', content: [{ type: 'text', text: '请用一句话回答：1+1等于几？' }] },
      ],
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    expect(fullText.length).toBeGreaterThan(0);
    expect(fullText).toMatch(/2|二|两/);
  });

  it('多轮对话：历史消息正确传递', async () => {
    const model = ollama(ollamaTestModel);

    const messages: ModelMessage[] = [
      { role: 'user', content: [{ type: 'text', text: '我的名字是小明' }] },
      { role: 'assistant', content: [{ type: 'text', text: '你好小明！很高兴认识你。' }] },
      { role: 'user', content: [{ type: 'text', text: '我叫什么名字？' }] },
    ];

    const result = streamText({
      model,
      messages,
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    expect(fullText.length).toBeGreaterThan(0);
    expect(fullText).toContain('小明');
  });

  it('带工具调用历史的多轮对话不报 400', async () => {
    // 模拟历史消息中包含 tool-call + tool-result 的场景
    // 这是之前 400 错误的核心复现场景
    const model = ollama(ollamaTestModel);

    // 构造包含工具调用历史的消息序列
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: '搜索AI信息' }],
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: '好的' },
          {
            type: 'tool-call',
            toolCallId: 'call-test-1',
            toolName: 'search',
            input: { query: 'AI' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-test-1',
            toolName: 'search',
            output: { type: 'text', value: 'AI是人工智能' },
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: '详细说说' }],
      },
    ];

    // 如果消息格式不正确（缺少 tool-call），API 会返回 400
    const result = streamText({
      model,
      messages,
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    // 只要不抛出 400 错误且有回复就算通过
    expect(fullText.length).toBeGreaterThan(0);
  });

  it('buildModelMessages 构建的历史可被 API 接受', async () => {
    // 端到端测试：使用 buildModelMessages 重建历史并发送给 ollama
    const model = ollama(ollamaTestModel);

    // 模拟数据库中的记录（之前的对话包含工具调用）
    const records: MessageRecord[] = [
      {
        id: 'u1', chatId: 'c1', content: '帮我查一下天气', short: '',
        role: 'user', timestamp: 1, status: MessageStatus.COMPLETED,
      },
      {
        id: 'a1', chatId: 'c1', content: '我来查一下天气信息。', short: '',
        role: 'assistant', timestamp: 2, status: MessageStatus.COMPLETED,
      },
      {
        id: 't1', chatId: 'c1', content: '北京今天晴，25度', short: '',
        role: 'tool', timestamp: 3, status: MessageStatus.COMPLETED,
        toolInvocation: {
          toolCallId: 'tc-weather-1',
          toolName: 'getWeather',
          input: { city: '北京' },
          output: { type: 'text', value: '北京今天晴，25度' },
        },
      },
      {
        id: 'a2', chatId: 'c1', content: '北京今天天气晴朗，气温25度。', short: '',
        role: 'assistant', timestamp: 4, status: MessageStatus.COMPLETED,
      },
    ];

    // 模拟 convertToModelMessages 的输出（只处理 non-tool 记录）
    const nonToolRecords = records.filter(r => r.role !== 'tool');
    const uiMessages = nonToolRecords.map(r => ({
      role: r.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: r.content as string, state: 'done' as const }],
    }));
    const converted = await convertToModelMessages(uiMessages);

    // 使用 buildModelMessages 重建
    const modelMessages = buildModelMessages(records, converted);

    // 追加新的用户消息
    modelMessages.push({
      role: 'user',
      content: [{ type: 'text', text: '那上海呢？' }],
    });

    // 验证消息结构正确性
    // assistant 后跟 tool 的消息应包含 tool-call part
    const assistantMsg = modelMessages.find(m => m.role === 'assistant' && Array.isArray(m.content));
    if (assistantMsg && Array.isArray(assistantMsg.content)) {
      const hasToolCall = (assistantMsg.content as any[]).some((p: any) => p.type === 'tool-call');
      expect(hasToolCall).toBe(true);
    }

    // 发送给 ollama - 不应该报 400
    let fullText = '';
    let errorOccurred: Error | null = null;
    try {
      const result = streamText({
        model,
        messages: modelMessages,
      });
      const resp = await result.response;
      for (const msg of resp.messages) {
        if (msg.role === 'assistant') {
          for (const part of msg.content) {
            const p = part as any;
            if (p && typeof p === 'object' && typeof p.text === 'string') {
              fullText += p.text;
            }
          }
        }
      }
    } catch (e: any) {
      errorOccurred = e;
    }

    // 核心验证：不应报 400 错误
    if (errorOccurred) {
      expect(errorOccurred.message).not.toContain('400');
    }
    // 如果没报错，应该有文本回复
    if (!errorOccurred) {
      expect(fullText.length).toBeGreaterThan(0);
    }
  });
});
