import { isTauri } from '@tauri-apps/api/core';

type LogFn = (message: string) => void | Promise<void>;

interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

const consoleFallback: Logger = {
  trace: (msg: string) => console.debug(`[TRACE] ${msg}`),
  debug: (msg: string) => console.debug(msg),
  info: (msg: string) => console.info(msg),
  warn: (msg: string) => console.warn(msg),
  error: (msg: string) => console.error(msg),
};

let _logger: Logger = consoleFallback;
let _initialized = false;

export async function initLogger(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  if (!isTauri()) return;

  try {
    const { trace, debug, info, warn, error, attachConsole } =
      await import('@tauri-apps/plugin-log');
    await attachConsole();
    _logger = { trace, debug, info, warn, error };
  } catch (e) {
    console.warn('[logger] Failed to initialize tauri-plugin-log:', e);
  }
}

function formatMessage(tag: string, args: unknown[]): string {
  const parts = args.map((arg) => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.message}\n${arg.stack ?? ''}`;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  });
  return tag ? `[${tag}] ${parts.join(' ')}` : parts.join(' ');
}

export const logger = {
  trace: (...args: unknown[]) => { _logger.trace(formatMessage('', args)); },
  debug: (...args: unknown[]) => { _logger.debug(formatMessage('', args)); },
  info: (...args: unknown[]) => { _logger.info(formatMessage('', args)); },
  warn: (...args: unknown[]) => { _logger.warn(formatMessage('', args)); },
  error: (...args: unknown[]) => { _logger.error(formatMessage('', args)); },
};

export function createLogger(tag: string) {
  return {
    trace: (...args: unknown[]) => { _logger.trace(formatMessage(tag, args)); },
    debug: (...args: unknown[]) => { _logger.debug(formatMessage(tag, args)); },
    info: (...args: unknown[]) => { _logger.info(formatMessage(tag, args)); },
    warn: (...args: unknown[]) => { _logger.warn(formatMessage(tag, args)); },
    error: (...args: unknown[]) => { _logger.error(formatMessage(tag, args)); },
  };
}
