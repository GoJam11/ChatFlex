/**
 * 数据库操作超时工具
 * 为数据库操作添加超时限制，防止长时间阻塞
 */

export interface TimeoutOptions {
  timeout?: number; // 超时时间（毫秒）
  timeoutMessage?: string; // 超时错误消息
}

/**
 * 为 Promise 添加超时限制
 */
export function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const { timeout = 10000, timeoutMessage = '操作超时' } = options;

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeout);
    })
  ]);
}

/**
 * 数据库操作超时装饰器
 */
export function dbTimeout(timeout: number = 10000, message?: string) {
  return function <T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (...args: T): Promise<R> {
      const timeoutMessage = message || `${propertyKey} 操作超时`;
      return withTimeout(originalMethod.apply(this, args), {
        timeout,
        timeoutMessage
      });
    };

    return descriptor;
  };
}

/**
 * 创建带超时的数据库操作包装器
 */
export function createDbOperationWrapper<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  options: TimeoutOptions = {}
) {
  return (...args: T): Promise<R> => {
    return withTimeout(operation(...args), options);
  };
}

/**
 * 批量操作超时控制
 * 对于需要处理多个操作的场景，提供批量超时控制
 */
export async function withBatchTimeout<T>(
  operations: (() => Promise<T>)[],
  options: TimeoutOptions & { batchSize?: number } = {}
): Promise<T[]> {
  const { timeout = 30000, timeoutMessage = '批量操作超时', batchSize = 10 } = options;

  const results: T[] = [];
  
  // 分批执行操作
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    
    const batchPromises = batch.map(op => 
      withTimeout(op(), { timeout: timeout / Math.ceil(operations.length / batchSize), timeoutMessage })
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * 数据库连接健康检查
 */
export async function checkDbHealth(
  healthCheck: () => Promise<boolean>,
  options: TimeoutOptions = {}
): Promise<boolean> {
  try {
    return await withTimeout(healthCheck(), {
      timeout: options.timeout || 5000,
      timeoutMessage: '数据库健康检查超时'
    });
  } catch (error) {
    console.error('[DB Health] 数据库健康检查失败:', error);
    return false;
  }
}