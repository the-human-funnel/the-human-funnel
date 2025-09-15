export interface AlertRule {
    id: string;
    name: string;
    description: string;
    condition: AlertCondition;
    severity: 'critical' | 'high' | 'medium' | 'low';
    enabled: boolean;
    cooldownMinutes: number;
    actions: AlertAction[];
    createdAt: Date;
    lastTriggered?: Date;
}
export interface AlertCondition {
    type: 'threshold' | 'pattern' | 'rate' | 'availability';
    metric: string;
    operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
    value: number;
    timeWindow?: number;
    aggregation?: 'avg' | 'sum' | 'count' | 'max' | 'min';
}
export interface AlertAction {
    type: 'log' | 'email' | 'webhook' | 'recovery';
    config: {
        [key: string]: any;
    };
}
export interface AlertNotification {
    id: string;
    ruleId: string;
    ruleName: string;
    severity: AlertRule['severity'];
    message: string;
    timestamp: Date;
    metadata?: any;
    acknowledged?: boolean;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
}
declare class AlertingService {
    private alertRules;
    private notifications;
    private cooldownTracker;
    private evaluationInterval;
    private maxNotificationHistory;
    constructor();
    private initializeDefaultRules;
    private generateRuleId;
    private startEvaluation;
    private evaluateRules;
    private evaluateRule;
    private triggerAlert;
    private executeAction;
    addRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): string;
    updateRule(ruleId: string, updates: Partial<Omit<AlertRule, 'id' | 'createdAt'>>): boolean;
    deleteRule(ruleId: string): boolean;
    getRules(): AlertRule[];
    getRule(ruleId: string): AlertRule | undefined;
    acknowledgeNotification(notificationId: string): boolean;
    acknowledgeNotification(notificationId: string, acknowledgedBy: string): boolean;
    getNotifications(acknowledged?: boolean): AlertNotification[];
    getAlertingStatus(): {
        rulesCount: number;
        enabledRules: number;
        notificationsCount: number;
        unacknowledgedNotifications: number;
    };
    shutdown(): void;
}
export declare const alertingService: AlertingService;
export {};
//# sourceMappingURL=alertingService.d.ts.map