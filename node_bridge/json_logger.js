/**
 * JSON Logger for Python Bridge
 * Outputs structured JSON logs to stdout for Python to parse
 */

class JSONLogger {
    constructor() {
        this.startTime = Date.now();
    }

    /**
     * Output a structured JSON message
     */
    output(data) {
        const timestamp = new Date().toISOString();
        const message = {
            ...data,
            timestamp
        };
        // Use stdout for structured data that Python will parse
        console.log(JSON.stringify(message));
    }

    /**
     * Log info message
     */
    log(message, metadata = {}) {
        this.output({
            type: 'log',
            level: 'info',
            message,
            ...metadata
        });
    }

    /**
     * Log success message
     */
    success(message, metadata = {}) {
        this.output({
            type: 'log',
            level: 'success',
            message,
            ...metadata
        });
    }

    /**
     * Log error message
     */
    error(message, metadata = {}) {
        this.output({
            type: 'log',
            level: 'error',
            message,
            ...metadata
        });
    }

    /**
     * Log warning message
     */
    warn(message, metadata = {}) {
        this.output({
            type: 'log',
            level: 'warn',
            message,
            ...metadata
        });
    }

    /**
     * Log a step (for workflow tracking)
     */
    step(message, metadata = {}) {
        this.output({
            type: 'log',
            level: 'step',
            message,
            ...metadata
        });
    }

    /**
     * Report progress update
     */
    progress(value, step = '') {
        this.output({
            type: 'progress',
            value: Math.min(100, Math.max(0, value)),
            step
        });
    }

    /**
     * Report successful completion
     */
    complete(message, metadata = {}) {
        this.output({
            type: 'success',
            message,
            ...metadata
        });
    }

    /**
     * Report failure
     */
    fail(message, metadata = {}) {
        this.output({
            type: 'error',
            message,
            ...metadata
        });
    }

    /**
     * Report video status change
     */
    videoStatus(video, status, metadata = {}) {
        this.output({
            type: 'video_status',
            video,
            status, // 'posted', 'failed', 'processing'
            ...metadata
        });
    }
}

module.exports = JSONLogger;
