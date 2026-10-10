import type { ProductionBatch } from "../schemas/batch";

const ALLOWED: Record<ProductionBatch["status"], ProductionBatch["status"][]> = {
  planned: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransition(
  from: ProductionBatch["status"],
  to: ProductionBatch["status"],
): boolean {
  return ALLOWED[from].includes(to);
}
