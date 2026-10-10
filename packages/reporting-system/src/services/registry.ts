import type { ReportDefinition } from "../schemas/report";

const BUILTIN_REPORTS: ReportDefinition[] = [
  {
    id: "inventory-stock",
    key: "inventory.stock_levels",
    name: "Stock levels",
    module: "inventory",
    format: "table",
  },
];

export function listAvailableReports(): ReportDefinition[] {
  return [...BUILTIN_REPORTS];
}
