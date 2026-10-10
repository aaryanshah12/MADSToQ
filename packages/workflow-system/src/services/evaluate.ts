import { workflowConfigSchema, type WorkflowConfig } from "../schemas/definition";

export function parseWorkflowConfig(raw: unknown): WorkflowConfig {
  return workflowConfigSchema.parse(raw);
}

export function canAdvance(config: WorkflowConfig, fromStepId: string, toStepId: string): boolean {
  return config.transitions.some((t) => t.from === fromStepId && t.to === toStepId);
}
