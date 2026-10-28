export type SagaStepStatus = "PENDING" | "COMPLETED" | "FAILED" | "COMPENSATED";

export interface SagaStepDefinition<TContext> {
  readonly stepName: string;
  readonly execute: (ctx: TContext) => Promise<void>;
  readonly compensate: (ctx: TContext) => Promise<void>;
}

export interface SagaExecutionLog {
  readonly stepName: string;
  readonly status: SagaStepStatus;
  readonly timestampMs: number;
  readonly errorDetail?: string;
}

export interface SagaExecutionResult {
  readonly succeeded: boolean;
  readonly logs: readonly SagaExecutionLog[];
}

export class PaymentSagaOrchestrator<TContext> {
  private readonly steps: SagaStepDefinition<TContext>[] = [];

  public registerStep(step: SagaStepDefinition<TContext>): this {
    this.steps.push(step);
    return this;
  }

  public async run(context: TContext): Promise<SagaExecutionResult> {
    const logs: SagaExecutionLog[] = [];
    const completedIndices: number[] = [];

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      if (!step) continue;

      try {
        await step.execute(context);
        completedIndices.push(i);
        logs.push({
          stepName: step.stepName,
          status: "COMPLETED",
          timestampMs: Date.now(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logs.push({
          stepName: step.stepName,
          status: "FAILED",
          timestampMs: Date.now(),
          errorDetail: message,
        });

        for (let j = completedIndices.length - 1; j >= 0; j--) {
          const completedIndex = completedIndices[j];
          if (completedIndex === undefined) continue;
          const completedStep = this.steps[completedIndex];
          if (!completedStep) continue;

          await completedStep.compensate(context);
          logs.push({
            stepName: completedStep.stepName,
            status: "COMPENSATED",
            timestampMs: Date.now(),
          });
        }

        return { succeeded: false, logs };
      }
    }

    return { succeeded: true, logs };
  }
}
