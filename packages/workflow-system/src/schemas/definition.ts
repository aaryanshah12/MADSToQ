import { z } from "zod";

export const workflowStepSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const workflowTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const workflowConfigSchema = z.object({
  steps: z.array(workflowStepSchema).min(1),
  transitions: z.array(workflowTransitionSchema),
});

export type WorkflowConfig = z.infer<typeof workflowConfigSchema>;
