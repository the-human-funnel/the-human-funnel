export declare class SystemIntegrationService {
    private static instance;
    private isInitialized;
    private systemHealth;
    private constructor();
    static getInstance(): SystemIntegrationService;
    initialize(): Promise<void>;
    performSystemHealthCheck(): Promise<any>;
    private checkExternalIntegrations;
    validateProcessingPipeline(jobProfileId: string, candidateIds: string[]): Promise<any>;
    performLoadTest(candidateCount: number, jobProfileId: string): Promise<any>;
    getSystemStatus(): any;
    shutdown(): Promise<void>;
}
export declare const systemIntegrationService: SystemIntegrationService;
//# sourceMappingURL=systemIntegrationService.d.ts.map