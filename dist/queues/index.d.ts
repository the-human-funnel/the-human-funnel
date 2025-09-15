import { Queue, Job, JobOptions } from 'bull';
import { JobData, JobProgress, QueueStats, BatchProgress } from '../models/interfaces';
export declare class QueueManager {
    private queues;
    private isInitialized;
    initialize(): Promise<void>;
    private setupQueueEventListeners;
    addJob(queueName: string, jobData: JobData, options?: JobOptions): Promise<Job>;
    addBatchJobs(jobs: Array<{
        queueName: string;
        jobData: JobData;
        options?: JobOptions;
    }>): Promise<Job[]>;
    getJobProgress(queueName: string, jobId: string): Promise<JobProgress | null>;
    getBatchProgress(batchId: string): Promise<BatchProgress | null>;
    getQueueStats(queueName: string): Promise<QueueStats | null>;
    getAllQueueStats(): Promise<QueueStats[]>;
    pauseQueue(queueName: string): Promise<void>;
    resumeQueue(queueName: string): Promise<void>;
    retryFailedJobs(queueName?: string): Promise<number | {
        [queueName: string]: number;
    }>;
    restartStalledJobs(): Promise<{
        [queueName: string]: number;
    }>;
    getHealthStatus(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    getAggregatedQueueStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }>;
    cleanQueue(queueName: string, grace?: number): Promise<void>;
    shutdown(): Promise<void>;
    getQueue(queueName: string): Queue | undefined;
    getAllQueues(): Map<string, Queue>;
    isReady(): boolean;
}
export declare const queueManager: QueueManager;
export declare const QUEUE_NAMES: {
    readonly RESUME_PROCESSING: "resume-processing";
    readonly AI_ANALYSIS: "ai-analysis";
    readonly LINKEDIN_ANALYSIS: "linkedin-analysis";
    readonly GITHUB_ANALYSIS: "github-analysis";
    readonly INTERVIEW_PROCESSING: "interview-processing";
    readonly SCORING: "scoring";
};
export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
//# sourceMappingURL=index.d.ts.map