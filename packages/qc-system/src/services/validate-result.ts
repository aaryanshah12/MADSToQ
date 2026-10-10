import type { QcInspection } from "../schemas/inspection";

export function isInspectionComplete(inspection: QcInspection): boolean {
  return inspection.result !== "pending";
}
