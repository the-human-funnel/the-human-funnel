import { ProcessingBatch } from '../models/interfaces';
export declare class QueueOrchestrator {
    processCandidateBatch(candidateIds: string[], jobProfileId: string): Promise<ProcessingBatch>;
    private createPipelineJobs;
    processIndividualCandidate(candidateId: string, jobProfileId: string, startFromStage?: 'resume' | 'ai-analysis' | 'linkedin' | 'github' | 'interview' | 'scoring'): Promise<string>;
    retryFailedCandidateStage(candidateId: string, jobProfileId: string, stage: 'resume' | 'ai-analysis' | 'linkedin' | 'github' | 'interview' | 'scoring'): Promise<string>;
    private getQueueNameForStage;
    pauseProcessing(): Promise<void>;
    resumeProcessing(): Promise<void>;
    retryAllFailedJobs(): Promise<{
        [queueName: string]: number;
    }>;
    cleanupOldJobs(gracePeriodMs?: number): Promise<void>;
    getSystemStatus(): Promise<{
        queues: any[];
        totalJobs: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
        };
    }>;
}
export declare const queueOrchestrator: QueueOrchestrator;
//# sourceMappingURL=queueOrchestrator.d.ts.map