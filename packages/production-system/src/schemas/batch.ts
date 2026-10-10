import { z } from "zod";

export const productionBatchSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  batchNumber: z.string(),
  productSku: z.string(),
  plannedQty: z.number().positive(),
  status: z.enum(["planned", "in_progress", "completed", "cancelled"]),
});

export type ProductionBatch = z.infer<typeof productionBatchSchema>;
