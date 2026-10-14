import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { chartSafe, money } from './contract'
import type { Filters, Overview } from './contract'

export function CaptureTrend({ data, currency }: { data: Overview['trend']; currency: Filters['currency'] }) {
  const [showTable, setShowTable] = useState(false)
  const safe = chartSafe(data)
  const tableVisible = showTable || !safe
  const coordinates = safe ? data.map((row) => ({ ...row,
    net_captured_minor: Number(row.net_captured_minor),
    settled_capture_minor: Number(row.settled_capture_minor),
    refunded_minor: Number(row.refunded_minor),
  })) : []
  const series = [
    { key: 'net_captured_minor', label: 'Net captured', color: 'var(--primary)' },
    { key: 'settled_capture_minor', label: 'Settled capture', color: 'var(--muted-foreground)' },
    { key: 'refunded_minor', label: 'Refunded', color: 'var(--foreground)' },
  ] as const
  return (
    <section aria-labelledby="trend-heading" className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="trend-heading" className="text-sm font-medium">Capture over time</h2>
          <p className="mt-1 text-xs text-muted-foreground">Daily ledger postings · {currency} · UTC</p></div>
        {safe && <Button variant="outline" size="sm" onClick={() => setShowTable(!showTable)} aria-expanded={showTable} aria-controls="trend-values">
          {showTable ? 'Hide data table' : 'Show data table'}
        </Button>}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-hidden="true">
        {series.map((s, index) => <span key={s.key} className="flex items-center gap-2">
          <svg width="18" height="8"><line x1="0" x2="18" y1="4" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={index ? '3 3' : undefined} /></svg>{s.label}
        </span>)}
      </div>
      {safe ? <div className="mt-5 h-64 w-full" role="img" aria-label="Daily capture trend. Exact values are available in the data table.">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height: 256 }}>
          <ComposedChart data={coordinates} margin={{ top: 8, right: 12, bottom: 0, left: 4 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} axisLine={false} tickLine={false} minTickGap={30} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <YAxis width={76} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={(v: number) => money(BigInt(Math.round(v)).toString(), currency)} />
            <Tooltip contentStyle={{ background: 'var(--popover)', color: 'var(--popover-foreground)', border: '1px solid var(--border)', borderRadius: 8 }}
              labelFormatter={(value) => `${String(value)} · UTC`} formatter={(value) => money(String(value), currency)} />
            <Area type="linear" dataKey="net_captured_minor" name="Net captured" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.08} strokeWidth={2} isAnimationActive={false} />
            <Line type="linear" dataKey="settled_capture_minor" name="Settled capture" stroke="var(--muted-foreground)" strokeDasharray="5 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
            <Line type="linear" dataKey="refunded_minor" name="Refunded" stroke="var(--foreground)" strokeDasharray="2 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div> : <p className="mt-4 text-sm text-muted-foreground">Amounts are too large to chart accurately. Exact values are shown below.</p>}
      {tableVisible && <div id="trend-values" className="mt-4 max-h-72 overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label="Daily capture values">
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">Daily capture values in {currency}, UTC dates</caption>
          <thead className="sticky top-0 bg-muted"><tr><th className="p-3">Date (UTC)</th>{series.map((s) => <th className="p-3 text-right" key={s.key}>{s.label}</th>)}</tr></thead>
          <tbody>{data.map((row) => <tr key={row.date} className="border-t"><th scope="row" className="whitespace-nowrap p-3 font-normal">{row.date}</th>
            {series.map((s) => <td className="whitespace-nowrap p-3 text-right" key={s.key}>{money(row[s.key], currency)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  )
}
