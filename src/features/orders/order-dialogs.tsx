import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RESOLVE_REASONS, resolveOrder } from '@/features/orders/api'
import type { OrderCase, ResolveReason, ResolveTarget } from '@/features/orders/api'
import { ordersKeys } from '@/features/orders/queries'
import { commandErrorText } from '@/lib/command-error'

/**
 * Resolving an order out of `manual_review` (ADR-051) — the portal's only
 * command whose effect the service cannot verify.
 *
 * The order is parked because a side effect is unaccounted for, and settling it
 * happened outside the platform. So this dialog is written to slow the operator
 * down at the right moment: the target is a radio list where each option states
 * what choosing it ASSERTS about the world, the reason names which effect was
 * settled, and the note is REQUIRED — the first mandatory free-text field in the
 * portal, because it is the only record of what the human actually checked.
 *
 * Native radio inputs and a native select rather than the Base UI primitives:
 * this is a short closed set where the consequence of each option needs to be
 * readable at a glance, and native controls come with keyboard and screen-reader
 * behaviour that a custom listbox would have to re-earn.
 */

/** What each target asserts, in the operator's terms. */
const TARGET_COPY: Record<ResolveTarget, { label: string; asserts: string }> = {
  cancelled: {
    label: 'Cancelled',
    asserts: 'The customer keeps no goods and owes nothing — any charge has been returned.',
  },
  failed: {
    label: 'Failed',
    asserts: 'The order never completed and will not be retried.',
  },
  confirmed: {
    label: 'Confirmed',
    asserts: 'Payment and stock are both accounted for; fulfilment may continue.',
  },
  completed: {
    label: 'Completed',
    asserts: 'The goods reached the customer and the money is settled.',
  },
}

const resolveSchema = z.object({
  target: z.enum(['cancelled', 'failed', 'confirmed', 'completed']),
  reason: z.enum([
    'REFUNDED_MANUALLY',
    'STOCK_RELEASED_MANUALLY',
    'SHIPMENT_CANCELLED_MANUALLY',
    'NO_SIDE_EFFECTS',
    'WRITTEN_OFF',
    'OPERATOR_RESOLVED',
  ]),
  note: z
    .string()
    .min(1, 'Say what you verified — this is the audit record')
    .max(512, 'Note must be 512 characters or fewer'),
})

export function ResolveDialog({
  order,
  onClose,
}: {
  order: OrderCase | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [replayed, setReplayed] = useState(false)

  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof resolveSchema>) =>
      resolveOrder(order!.id, {
        target: value.target,
        // The version read with the case. A stale one is refused by the
        // service, which is the point of sending it rather than trusting the
        // page to still be current.
        version: order!.version,
        reason: value.reason,
        note: value.note,
      }),
    onSuccess: async (result) => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ordersKeys.all })
      // A replay wrote nothing. Say so instead of closing on a silent no-op,
      // so the operator does not read "it worked" as "I just changed this".
      if (!result.applied) {
        setReplayed(true)
        return
      }
      onClose()
    },
    onError: (err) => setError(commandErrorText(err, 'order')),
  })

  const form = useForm({
    defaultValues: {
      target: 'cancelled' as ResolveTarget,
      reason: 'REFUNDED_MANUALLY' as ResolveReason,
      note: '',
    },
    validators: { onSubmit: resolveSchema },
    onSubmit: ({ value }) => mutation.mutate(value),
  })

  if (!order) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve order #{order.id}</DialogTitle>
          <DialogDescription>
            This records a decision a human made. Settle the side effect first — the
            refund, the stock release, the shipment — then say here which state the
            world now matches. Nothing about this is undone automatically, and the
            record below is permanent.
          </DialogDescription>
        </DialogHeader>

        {replayed ? (
          <div className="flex flex-col gap-3">
            <p role="status" className="text-sm">
              This exact decision was already recorded — nothing changed just now. Close
              and reload the case to see what stands.
            </p>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            <form.Field name="target">
              {(field) => (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">Move the order to</legend>
                  {(Object.keys(TARGET_COPY) as Array<ResolveTarget>).map((target) => (
                    <label
                      key={target}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm has-checked:border-primary"
                    >
                      <input
                        type="radio"
                        name="resolve-target"
                        value={target}
                        className="mt-0.5"
                        checked={field.state.value === target}
                        onChange={() => field.handleChange(target)}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{TARGET_COPY[target].label}</span>
                        <span className="text-xs text-muted-foreground">
                          {TARGET_COPY[target].asserts}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </form.Field>

            <form.Field name="reason">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resolve-reason">What did you settle?</Label>
                  <select
                    id="resolve-reason"
                    className="h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value as ResolveReason)}
                  >
                    {RESOLVE_REASONS.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </form.Field>

            <form.Field name="note">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="resolve-note">What did you verify? (required)</Label>
                  <textarea
                    id="resolve-note"
                    rows={3}
                    maxLength={512}
                    className="rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    placeholder="e.g. refund 25.98 confirmed in the provider console at 14:02"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((issue, i) => (
                    <p key={i} className="text-xs text-destructive">
                      {typeof issue === 'string'
                        ? issue
                        : ((issue as { message?: string } | null)?.message ?? 'Invalid value')}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending ? 'Recording…' : 'Record this decision'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
