"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import PageHeader from "@/components/ui/PageHeader";
import { inventoryApi } from '@/lib/client/inventory-api'
import { stockApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle } from "lucide-react";

export default function NewStockEntryPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    factory_id: "",
    invoice_number: "",
    supplier_name: "",
    material_type: "",
    tons_loaded: "",
    rate_per_ton: "",
    vehicle_number: "",
    driver_name: "",
    entry_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [factories, setFactories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const materialOptions = useMemo(() => {
    const selectedFactory = factories.find((f) => f.id === form.factory_id);
    const materials: string[] = selectedFactory?.materials ?? [];
    // Always allow a fallback "Other" option
    return materials.length > 0 ? [...materials, "Other"] : ["Other"];
  }, [factories, form.factory_id]);

  useEffect(() => {
    if (!profile?.factories) return;
    setFactories(profile.factories);
    if (profile.factories.length === 1)
      setForm((f) => ({ ...f, factory_id: profile.factories![0].id }));
  }, [profile]);

  useEffect(() => {
    if (!form.factory_id) { setSuppliers([]); return }
    inventoryApi.getSuppliers(form.factory_id).then(({ suppliers }) => setSuppliers(suppliers ?? []))
  }, [form.factory_id])

  const totalValue =
    form.tons_loaded && form.rate_per_ton
      ? (Number(form.tons_loaded) * Number(form.rate_per_ton)).toLocaleString(
          "en-IN",
        )
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await stockApi.create({
      ...form,
      tons_loaded: Number(form.tons_loaded),
      rate_per_ton: Number(form.rate_per_ton),
      created_by: profile!.id,
    });
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/inventory/inputer/history"), 1500);
  }

  function update(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  if (success)
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center animate-fade-up">
            <CheckCircle size={56} className="text-chemist mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold text-primary mb-2">
              Entry Saved!
            </h2>
            <p className="text-muted">Redirecting to your history...</p>
          </div>
        </div>
      </AppLayout>
    );

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
        <PageHeader
          title="New Stock Entry"
          subtitle="Inputer · Log Incoming Material"
          accent="inputer"
        />

        <form onSubmit={handleSubmit} className="card p-8 space-y-6">
          {/* Factory */}
          <div>
            <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
              Factory *
            </label>
            <select
              className="input-field"
              value={form.factory_id}
              onChange={(e) => {
                const nextId = e.target.value;
                setForm((f) => ({
                  ...f,
                  factory_id: nextId,
                  // reset material selection when factory changes
                  material_type: "",
                }));
              }}
              required>
              <option value="">Select factory</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice + Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Invoice Number *
              </label>
              <input
                className="input-field"
                value={form.invoice_number}
                onChange={(e) => update("invoice_number", e.target.value)}
                required
                placeholder="INV-2024-001"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Supplier Name *
              </label>
              <select
                className="input-field"
                value={form.supplier_name}
                onChange={(e) => update("supplier_name", e.target.value)}
                required
                disabled={!form.factory_id}
              >
                <option value="">{form.factory_id ? 'Select supplier' : 'Select factory first'}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Material type */}
          <div>
            <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
              Material Type *
            </label>
            <select
              className="input-field"
              value={form.material_type}
              onChange={(e) => update("material_type", e.target.value)}
              required>
              <option value="">Select material</option>
              {materialOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Tons + Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                KGS Loaded *
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                className="input-field"
                value={form.tons_loaded}
                onChange={(e) => update("tons_loaded", e.target.value)}
                required
                placeholder="25.500"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Rate / KGs (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                value={form.rate_per_ton}
                onChange={(e) => update("rate_per_ton", e.target.value)}
                required
                placeholder="4500.00"
              />
            </div>
          </div>

          {/* Total value display */}
          {totalValue && (
            <div className="bg-owner/8 border border-owner/25 rounded-lg px-5 py-3 flex items-center justify-between animate-fade-up">
              <span className="font-mono text-xs text-muted uppercase tracking-widest">
                Total Invoice Value
              </span>
              <span className="font-display text-2xl font-bold text-owner">
                ₹{totalValue}
              </span>
            </div>
          )}

          {/* Vehicle + Driver */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Vehicle Number
              </label>
              <input
                className="input-field"
                value={form.vehicle_number}
                onChange={(e) => update("vehicle_number", e.target.value)}
                placeholder="GJ-01-AB-1234"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
                Driver Name
              </label>
              <input
                className="input-field"
                value={form.driver_name}
                onChange={(e) => update("driver_name", e.target.value)}
                placeholder="Driver name"
              />
            </div>
          </div>

          {/* Entry date */}
          <div>
            <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
              Entry Date *
            </label>
            <input
              type="date"
              className="input-field"
              value={form.entry_date}
              onChange={(e) => update("entry_date", e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-mono text-xs text-muted uppercase tracking-widest mb-2">
              Notes
            </label>
            <textarea
              className="input-field resize-none"
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Any additional notes..."
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-inputer flex-1 justify-center py-3 text-base">
              {loading ? "Saving..." : "✓ Save Stock Entry"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-ghost px-6">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}