"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/utils";

export type MonthlyFinancePoint = {
  month: string;
  revenue: number;
  hpp: number;
  profit: number;
};

type Props = {
  data: MonthlyFinancePoint[];
};

export function RevenueHppProfitChart({ data }: Props) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#a3a3a3" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#a3a3a3"
            tickFormatter={(v) =>
              new Intl.NumberFormat("id-ID", {
                notation: "compact",
                compactDisplay: "short",
              }).format(v)
            }
          />
          <Tooltip
            formatter={(value) => formatRupiah(Number(value ?? 0))}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              fontSize: 12,
              background: "#fff",
            }}
          />
          <Legend />
          <Bar dataKey="revenue" name="Revenue" fill="#0a0a0a" radius={[4, 4, 0, 0]} />
          <Bar dataKey="hpp" name="HPP" fill="#a3a3a3" radius={[4, 4, 0, 0]} />
          <Line
            type="monotone"
            dataKey="profit"
            name="Profit"
            stroke="#525252"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#0a0a0a" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
