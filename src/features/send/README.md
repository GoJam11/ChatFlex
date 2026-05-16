# Send 功能模块

该模块包含消息发送和会话总结功能。

## 文件结构

- `send.ts` - 核心消息发送功能
- `summary.ts` - 消息发送后的会话总结功能

## 会话总结功能 (summary.ts)

### 功能说明

在用户发送消息并收到AI回复后，自动为会话生成简洁的标题。

### 触发条件

1. **已开启会话总结功能**: 需要在设置中启用 `chat.autoSummary.enabled` 
2. **会话还没有标题**: 会话的 `short` 字段为空或未设置
3. **消息数量足够**: 至少需要2条消息（用户问题 + AI回答）

### 使用方式

会话总结功能会在消息发送完成后自动触发，无需手动调用。

**在 EditArea 中的调用：**

```typescript
// EditArea.vue 中的使用
const result = await send({
  prompt: messageContent,
  chatId: targetChatId,
  providerConfig,      // 主对话模型配置
  summaryConfig,       // 专用总结模型配置
});
```

**总结配置的获取逻辑：**

1. 如果设置了专用的总结模型配置且启用了总结功能，使用专用配置
2. 如果启用了总结功能但没有专用配置，回退到当前对话模型配置
3. 如果未启用总结功能，不传递 summaryConfig（跳过总结）

### 配置设置

使用设置存储启用会话总结并配置专用模型：

```typescript
import { useSettingStore } from '@/features/setting/useSettingStore';

const settingStore = useSettingStore();
settingStore.enableAiSummary = true;
settingStore.summaryProvider = 'openai';
settingStore.summaryModel = 'gpt-4o-mini';
settingStore.summaryApiKey = 'your-summary-api-key';
settingStore.summaryBaseURL = 'https://api.openai.com/v1';
```

### 工作流程

1. **检查条件**: 验证是否满足总结条件
2. **获取消息**: 获取会话前几条消息用于分析
3. **生成标题**: 使用AI模型生成5-15字的简洁标题
4. **更新数据库**: 将生成的标题保存到会话的 `short` 字段

### API 接口

#### `summarizeConversation(input: SummaryInput): Promise<SummaryResult>`

同步执行会话总结。

**参数:**
- `input.chatId`: 会话ID
- `input.providerConfig`: (可选) 自定义AI服务配置

**返回值:**
```typescript
interface SummaryResult {
  success: boolean;
  title?: string;
  error?: string;
}
```

#### `summarizeConversationAsync(input: SummaryInput): void`

异步执行会话总结，不阻塞主流程。

### 错误处理

- 如果会话已有标题，会跳过总结
- 如果功能未启用，会跳过总结
- 如果消息数量不足，会跳过总结
- AI生成失败时会记录错误日志但不影响主流程

### 日志输出

```
[summary] 开始会话总结: chat-id
[summary] 跳过总结: 会话已有标题
[summary] 会话总结完成: 生成的标题
[summary] 会话总结失败: 错误信息
```

## 集成说明

会话总结功能已集成到 `send.ts` 中，在AI响应完成后自动触发：

```typescript
// 在 handleAIStream 函数的最后
if (summaryConfig) {
  summarizeConversationAsync({
    chatId,
    providerConfig: summaryConfig  // 使用专用的总结配置
  });
}
```

### 配置管理

`useSettingStore` 暴露的响应式属性即为设置的唯一来源，可直接读写：

```typescript
import { useSettingStore } from '@/features/setting/useSettingStore';

const settingStore = useSettingStore();
if (settingStore.enableAiSummary) {
  console.log('当前总结模型:', settingStore.summaryProvider, settingStore.summaryModel);
}
```

所有变更都会自动持久化到本地存储，确保不会阻塞消息发送流程，并且可以使用与主对话不同的模型进行总结。


这确保了用户体验的流畅性，总结过程不会阻塞消息发送流程，并且可以使用与主对话不同的模型进行总结。