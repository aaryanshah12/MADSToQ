import { Card, CardContent, CardHeader, CardTitle } from "@madstoq/ui";

export type InventorySummaryProps = {
  totalItems: number;
  totalQuantity: number;
};

/** Generic inventory summary — no client-specific branding */
export function InventorySummary({ totalItems, totalQuantity }: InventorySummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory overview</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[hsl(var(--muted-foreground))]">Active SKUs</p>
          <p className="text-2xl font-semibold">{totalItems}</p>
        </div>
        <div>
          <p className="text-[hsl(var(--muted-foreground))]">Total quantity</p>
          <p className="text-2xl font-semibold">{totalQuantity.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}
