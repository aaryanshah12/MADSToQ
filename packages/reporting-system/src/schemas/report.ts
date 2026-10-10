import { z } from "zod";

export const reportDefinitionSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  module: z.enum(["inventory", "production", "qc", "workflow"]),
  format: z.enum(["table", "chart", "export"]),
});

export type ReportDefinition = z.infer<typeof reportDefinitionSchema>;
