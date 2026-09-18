"use client";

import { useEffect, useState } from "react";
import type { Tables } from "@/lib/supabase/types";

type Customer = Tables<"profiles"> & { order_count: number; total_spent: number };

export function UsersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/customers")
      .then((res) => res.json())
      .then((json) => setCustomers(json.customers ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-display text-sm font-semibold">Customers ({customers.length})</h2>
        {loading ? (
          <p className="py-8 text-center text-xs text-text-dim">Loading…</p>
        ) : customers.length === 0 ? (
          <p className="py-8 text-center text-xs text-text-dim">No customer accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wide text-text-dim">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Joined</th>
                  <th className="pb-2 pr-4 font-medium">Orders</th>
                  <th className="pb-2 font-medium">Delivered value</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-medium">{c.name}</td>
                    <td className="py-2.5 pr-4 text-text-dim">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-4 text-text-dim">{c.order_count}</td>
                    <td className="py-2.5 text-text-dim">₹{c.total_spent.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
