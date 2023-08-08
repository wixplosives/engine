import type { LogLevel } from './types.js';

export interface LogMetadata {
    [key: string]: unknown;
}

export interface LogMessage {
    /**
     * Actual text of log message.
     */
    message: string;

    /**
     * UTC timestamp when the message was logged (Date.now)
     */
    timestamp: number;

    /**
     * Severity level of the message.
     */
    level: LogLevel;

    /**
     * Optional string map to add to the message.
     */
    metadata?: LogMetadata;
}
