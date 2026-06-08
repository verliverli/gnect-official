'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface GrowthChartProps {
  data: { date: string; count: number }[]
}

export function GrowthChart({ data }: GrowthChartProps) {
  if (data.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No data</p>
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          width={25}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Area type="monotone" dataKey="count" stroke="#25D366" fill="url(#signupGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
