export interface RecoveryAction {
    type: 'retry' | 'restart' | 'skip' | 'manual';
    description: string;
    maxAttempts?: number;
    backoffMs?: number;
}
export interface FailurePattern {
    service: string;
    operation: string;
    errorType: string;
    count: number;
    firstOccurrence: Date;
    lastOccurrence: Date;
    recoveryAction: RecoveryAction;
}
export interface RecoveryResult {
    success: boolean;
    action: string;
    details?: any;
    error?: string;
}
declare class ErrorRecoveryService {
    private failurePatterns;
    private recoveryInProgress;
    private maxPatternHistory;
    constructor();
    private getPatternKey;
    private cleanupOldPatterns;
    recordFailure(service: string, operation: string, errorType: string, error?: any): void;
    private determineRecoveryAction;
    private shouldTriggerRecovery;
    private triggerRecovery;
    private executeRetryRecovery;
    private handleAiProviderFailure;
    private handleLinkedInFailure;
    private handleGitHubFailure;
    private handleVapiFailure;
    private executeRestartRecovery;
    private executeSkipRecovery;
    retryFailedJobs(queueName?: string): Promise<RecoveryResult>;
    clearFailurePatterns(): Promise<void>;
    getFailurePatterns(): FailurePattern[];
    getRecoveryStatus(): {
        inProgress: string[];
        patterns: number;
    };
}
export declare const errorRecoveryService: ErrorRecoveryService;
export {};
//# sourceMappingURL=errorRecoveryService.d.ts.map