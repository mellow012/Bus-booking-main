/**
 * Structured Logging Utility
 * Provides consistent, centralized logging across the application
 * Logs can be filtered, searched, and monitored
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogCategory = 'auth' | 'payment' | 'booking' | 'company' | 'api' | 'security' | 'notification';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  userId?: string;
  ip?: string;
  action?: string;
  metadata?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger class with structured logging
 */
class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Format log entry for console output
   */
  private formatLog(entry: LogEntry): string {
    const levelEmoji: Record<LogLevel, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    };

    const prefix = `[${entry.timestamp}] ${levelEmoji[entry.level]} [${entry.category.toUpperCase()}]`;
    const userInfo = entry.userId ? ` [User: ${entry.userId}]` : '';
    const ipInfo = entry.ip ? ` [IP: ${entry.ip}]` : '';

    return `${prefix}${userInfo}${ipInfo}: ${entry.message}`;
  }

  /**
   * Send log entry to Cloud Logging (production)
   */
  private async sendToCloudLogging(entry: LogEntry): Promise<void> {
    if (this.isDevelopment) return;

    try {
      // In production, you can send to Google Cloud Logging
      // For now, logs go to console which is collected by Cloud Run/App Engine
      // This is how it appears in Cloud Logging interface
      console.log(JSON.stringify(entry));
    } catch (error) {
      console.error('Failed to send to Cloud Logging:', error);
    }
  }

  /**
   * Log formatted entry
   */
  private async log(entry: LogEntry): Promise<void> {
    // Console output (development + always visible)
    const formatted = this.formatLog(entry);
    const consoleMethod = entry.level === 'error' ? console.error : 
                         entry.level === 'warn' ? console.warn :
                         entry.level === 'debug' ? console.debug :
                         console.log;
    consoleMethod(formatted);

    // Send to Cloud Logging for production
    if (!this.isDevelopment) {
      await this.sendToCloudLogging(entry);
    }
  }

  /**
   * Log successful action
   */
  async logSuccess(
    category: LogCategory,
    message: string,
    options?: {
      userId?: string;
      ip?: string;
      action?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      category,
      message,
      userId: options?.userId,
      ip: options?.ip,
      action: options?.action,
      metadata: options?.metadata,
    });
  }

  /**
   * Log warning
   */
  async logWarning(
    category: LogCategory,
    message: string,
    options?: {
      userId?: string;
      ip?: string;
      action?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      category,
      message,
      userId: options?.userId,
      ip: options?.ip,
      action: options?.action,
      metadata: options?.metadata,
    });
  }

  /**
   * Log error
   */
  async logError(
    category: LogCategory,
    message: string,
    error: Error | any,
    options?: {
      userId?: string;
      ip?: string;
      action?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'error',
      category,
      message,
      userId: options?.userId,
      ip: options?.ip,
      action: options?.action,
      metadata: options?.metadata,
      error: {
        code: error?.code || error?.message || 'UNKNOWN_ERROR',
        message: error?.message || JSON.stringify(error),
        stack: this.isDevelopment ? error?.stack : undefined,
      },
    });
  }

  /**
   * Log security event (suspicious activity)
   */
  async logSecurityEvent(
    message: string,
    ip?: string,
    options?: {
      userId?: string;
      action?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      category: 'security',
      message,
      userId: options?.userId,
      ip,
      action: options?.action,
      metadata: options?.metadata,
    });
  }

  /**
   * Log payment transaction
   */
  async logPayment(
    message: string,
    bookingId: string,
    amount: number,
    provider: string,
    success: boolean,
    options?: {
      userId?: string;
      ip?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: success ? 'info' : 'error',
      category: 'payment',
      message,
      userId: options?.userId,
      ip: options?.ip,
      action: `payment_${success ? 'success' : 'failed'}`,
      metadata: {
        bookingId,
        amount,
        provider,
        ...options?.metadata,
      },
    });
  }

  /**
   * Log booking action
   */
  async logBooking(
    action: 'created' | 'updated' | 'cancelled' | 'confirmed',
    bookingId: string,
    options?: {
      userId?: string;
      companyId?: string;
      scheduleId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      category: 'booking',
      message: `Booking ${action}`,
      userId: options?.userId,
      action: `booking_${action}`,
      metadata: {
        bookingId,
        companyId: options?.companyId,
        scheduleId: options?.scheduleId,
        ...options?.metadata,
      },
    });
  }
}

// Export singleton instance
export const logger = new Logger();
