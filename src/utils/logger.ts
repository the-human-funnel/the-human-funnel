interface LogLevel {
  ERROR: 0;
  WARN: 1;
  INFO: 2;
  DEBUG: 3;
}

const LOG_LEVELS: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class Logger {
  private logLevel: number;

  constructor() {
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    this.logLevel = LOG_LEVELS[envLogLevel as keyof LogLevel] ?? LOG_LEVELS.INFO;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }

  private shouldLog(level: number): boolean {
    return level <= this.logLevel;
  }

  error(message: string, error?: Error | any, meta?: any): void {
    if (!this.shouldLog(LOG_LEVELS.ERROR)) return;
    
    const errorInfo = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    
    const combinedMeta = { ...meta, error: errorInfo };
    console.error(this.formatMessage('ERROR', message, combinedMeta));
  }

  warn(message: string, meta?: any): void {
    if (!this.shouldLog(LOG_LEVELS.WARN)) return;
    console.warn(this.formatMessage('WARN', message, meta));
  }

  info(message: string, meta?: any): void {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    console.log(this.formatMessage('INFO', message, meta));
  }

  debug(message: string, meta?: any): void {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    console.log(this.formatMessage('DEBUG', message, meta));
  }

  setLogLevel(level: keyof LogLevel): void {
    this.logLevel = LOG_LEVELS[level];
  }
}

// Create singleton instance
export const logger = new Logger();
export default logger;