export interface SagaStep {
  stepName: string;
  action: () => Promise<void> | void;
  compensate: () => Promise<void> | void;
}

/**
 * Stateful Saga Orchestrator for distributed transactional workflows and automated rollbacks.
 */
export class SagaOrchestrator {
  public async executeSaga(steps: SagaStep[]): Promise<{ status: 'COMPLETED' | 'COMPENSATED'; failedStep?: string }> {
    const executedSteps: SagaStep[] = [];

    try {
      for (const step of steps) {
        await step.action();
        executedSteps.push(step);
      }
      return { status: 'COMPLETED' };
    } catch (error) {
      // Rollback executed steps in reverse order (LIFO)
      for (let i = executedSteps.length - 1; i >= 0; i--) {
        try {
          await executedSteps[i].compensate();
        } catch (compensateError) {
          // Log catastrophic compensation failure in production
          console.error(`Saga Compensation Failed at step '${executedSteps[i].stepName}':`, compensateError);
        }
      }
      return { status: 'COMPENSATED', failedStep: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
