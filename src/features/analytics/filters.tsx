import { useForm } from '@tanstack/react-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { currencies, filtersSchema, presetFilters } from './contract'
import type { Filters } from './contract'

export function AnalyticsFilters({ filters, onChange }: { filters: Filters; onChange: (value: Filters) => void }) {
  const form = useForm({
    defaultValues: filters,
    validators: { onSubmit: filtersSchema },
    onSubmit: ({ value }) => onChange(filtersSchema.parse(value)),
  })
  const selectedDays = (Date.parse(filters.to) - Date.parse(filters.from)) / 86_400_000
  return (
    <section aria-label="Analytics filters" className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Date range presets" className="flex gap-1 rounded-lg bg-muted p-1">
          {[7, 30, 90].map((days) => (
            <Button key={days} variant={selectedDays === days ? 'outline' : 'ghost'} className="h-9 px-3"
              aria-pressed={selectedDays === days} onClick={() => onChange(presetFilters(filters, days))}>
              {days} days
            </Button>
          ))}
        </div>
        <form className="grid w-full grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap xl:w-auto" onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }} noValidate>
          <form.Field name="currency">{(field) => (
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <select id="currency" value={field.state.value} onChange={(e) => field.handleChange(e.target.value as Filters['currency'])}
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
                {currencies.map((currency) => <option key={currency}>{currency}</option>)}
              </select>
            </div>
          )}</form.Field>
          <form.Field name="from">{(field) => (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none">
              <Label htmlFor="from">From · UTC</Label>
              <Input id="from" type="date" value={field.state.value} onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)} className="h-9 w-full sm:w-40"
                aria-describedby="range-help" aria-invalid={field.state.meta.errors.length > 0} />
            </div>
          )}</form.Field>
          <form.Field name="to">{(field) => (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-none">
              <Label htmlFor="to">To · UTC (exclusive)</Label>
              <Input id="to" type="date" value={field.state.value} onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)} className="h-9 w-full sm:w-40"
                aria-describedby="range-help" aria-invalid={field.state.meta.errors.length > 0} />
            </div>
          )}</form.Field>
          <Button type="submit" variant="outline" className="col-span-2 h-9">Apply</Button>
          <form.Subscribe selector={(state) => state.errors}>{(errors) => errors.length > 0 && (
            <p role="alert" className="col-span-2 w-full text-sm text-destructive">Enter valid dates and a UTC interval of 1 to 90 days.</p>
          )}</form.Subscribe>
        </form>
      </div>
      <p id="range-help" className="mt-3 text-xs text-muted-foreground">Start included, end excluded. One currency per view; no currency conversion.</p>
    </section>
  )
}
