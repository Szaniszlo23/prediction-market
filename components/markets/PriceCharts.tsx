"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  time: string;
  price: number;
};

type MultiPoint = {
  time: string;
  [key: string]: number | string | null;
};

type BinaryPriceChartProps = {
  data: Point[];
};

type CategoricalPriceChartProps = {
  data: MultiPoint[];
  outcomeLabels: string[];
};

const COLORS = ["#22c55e", "#3b82f6", "#f97316", "#a855f7", "#ef4444", "#14b8a6"];

export function BinaryPriceChart({ data }: BinaryPriceChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No trade history yet.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[0, 1]} />
          <Tooltip formatter={(value) => `${(Number(value) * 100).toFixed(1)}%`} />
          <Line dataKey="price" dot={false} stroke="#22c55e" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoricalPriceChart({ data, outcomeLabels }: CategoricalPriceChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No trade history yet.</p>;
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[0, 1]} />
          <Tooltip formatter={(value) => `${(Number(value) * 100).toFixed(1)}%`} />
          <Legend />
          {outcomeLabels.map((label, index) => (
            <Line
              key={label}
              dataKey={label}
              dot={false}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OutcomeMiniChart({ data }: BinaryPriceChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No trade history yet.</p>;
  }

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[0, 1]} />
          <Tooltip formatter={(value) => `${(Number(value) * 100).toFixed(1)}%`} />
          <Line dataKey="price" dot={false} stroke="#3b82f6" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
