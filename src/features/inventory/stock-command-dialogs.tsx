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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adjustStock, receiveStock } from '@/features/inventory/api'
import type { Balance } from '@/features/inventory/api'
import { inventoryKeys } from '@/features/inventory/queries'
import { ApiError } from '@/lib/api'

/**
 * The two slice-A stock commands (RFC-0023). Conventions:
 *  - `command_id` is minted when the dialog OPENS and kept for the dialog's
 *    lifetime — a retry after an uncertain outcome replays, never re-applies.
 *  - Adjustments require a reason; both commands preview the balance impact
 *    before the operator confirms.
 *  - `applied:false` (idempotent replay) is surfaced honestly, not as a
 *    fresh success.
 */

interface DialogProps {
  balance: Balance | null
  onClose: () => void
}

function useCommandState() {
  const queryClient = useQueryClient()
  // One command id per dialog instance (the dialog unmounts on close).
  const [commandId] = useState(() => crypto.randomUUID())
  const [outcome, setOutcome] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return { queryClient, commandId, outcome, setOutcome, error, setError }
}

function commandErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'IDEMPOTENCY_CONFLICT') {
      return 'This command id was already used with a different payload — close the dialog and start a new command.'
    }
    if (err.code === 'STOCK_UNAVAILABLE') {
      return 'The adjustment would violate the balance invariants (on-hand can never drop below reserved or zero).'
    }
    return `${err.message} (${err.code})`
  }
  return 'The command did not complete — its outcome is unknown. Submit again with the same dialog to replay safely.'
}

function issueText(err: unknown): string {
  if (typeof err === 'string') return err
  return (err as { message?: string } | null)?.message ?? 'Invalid value'
}

const receiptSchema = z.object({
  quantity: z
    .number('Enter a quantity')
    .int('Quantity must be a whole number')
    .positive('Quantity must be a positive integer'),
  reason: z.string().max(64, 'Reason must be 64 characters or fewer'),
})

export function ReceiveStockDialog({ balance, onClose }: DialogProps) {
  const { queryClient, commandId, outcome, setOutcome, error, setError } =
    useCommandState()

  const mutation = useMutation({
    mutationFn: receiveStock,
    onSuccess: async (result) => {
      setError(null)
      setOutcome(
        result.applied
          ? 'Stock received.'
          : 'Already applied earlier (idempotent replay) — no double-count.',
      )
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
    onError: (err) => setError(commandErrorText(err)),
  })

  const form = useForm({
    defaultValues: { quantity: 1, reason: '' },
    validators: { onSubmit: receiptSchema },
    onSubmit: ({ value }) => {
      if (!balance) return
      mutation.mutate({
        command_id: commandId,
        sku_id: balance.sku_id,
        warehouse_id: balance.warehouse_id,
        quantity: Number(value.quantity),
        reason: value.reason || undefined,
      })
    },
  })

  if (!balance) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            SKU <span className="font-mono text-[13px]">{balance.sku_id}</span>,
            warehouse {balance.warehouse_id} — currently {balance.on_hand} on hand.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="quantity">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="receive-quantity">Quantity to receive</Label>
                <Input
                  id="receive-quantity"
                  type="number"
                  min={1}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.valueAsNumber)}
                />
                {field.state.meta.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {issueText(err)}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
          <form.Field name="reason">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="receive-reason">Reason (optional, e.g. PO number)</Label>
                <Input
                  id="receive-reason"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.quantity}>
            {(quantity) => (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                On hand {balance.on_hand} →{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {balance.on_hand + (Number.isFinite(quantity) ? Number(quantity) : 0)}
                </span>
              </p>
            )}
          </form.Subscribe>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {outcome ? <p className="text-sm text-foreground">{outcome}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {outcome ? 'Close' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !!outcome}>
              {mutation.isPending ? 'Receiving…' : 'Receive'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const adjustmentSchema = z.object({
  delta: z
    .number('Enter a delta')
    .int('Delta must be a whole number')
    .refine((n) => n !== 0, 'Delta must not be zero'),
  reason: z
    .string()
    .min(1, 'A reason is required for adjustments')
    .max(64, 'Reason must be 64 characters or fewer'),
})

export function AdjustStockDialog({ balance, onClose }: DialogProps) {
  const { queryClient, commandId, outcome, setOutcome, error, setError } =
    useCommandState()

  const mutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: async (result) => {
      setError(null)
      setOutcome(
        result.applied
          ? 'Adjustment applied.'
          : 'Already applied earlier (idempotent replay) — no double-count.',
      )
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
    onError: (err) => setError(commandErrorText(err)),
  })

  const form = useForm({
    defaultValues: { delta: -1, reason: '' },
    validators: { onSubmit: adjustmentSchema },
    onSubmit: ({ value }) => {
      if (!balance) return
      mutation.mutate({
        command_id: commandId,
        sku_id: balance.sku_id,
        warehouse_id: balance.warehouse_id,
        delta: Number(value.delta),
        reason: value.reason,
      })
    },
  })

  if (!balance) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust on-hand stock</DialogTitle>
          <DialogDescription>
            SKU <span className="font-mono text-[13px]">{balance.sku_id}</span>,
            warehouse {balance.warehouse_id} — {balance.on_hand} on hand,{' '}
            {balance.reserved} reserved. On hand can never drop below reserved.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="delta">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adjust-delta">Signed delta (negative = shrinkage)</Label>
                <Input
                  id="adjust-delta"
                  type="number"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.valueAsNumber)}
                />
                {field.state.meta.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {issueText(err)}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
          <form.Field name="reason">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="adjust-reason">Reason (required)</Label>
                <Input
                  id="adjust-reason"
                  placeholder="shrinkage, recount, damage…"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {issueText(err)}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(s) => s.values.delta}>
            {(delta) => {
              const next =
                balance.on_hand + (Number.isFinite(delta) ? Number(delta) : 0)
              const invalid = next < balance.reserved || next < 0
              return (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  On hand {balance.on_hand} →{' '}
                  <span
                    className={
                      invalid
                        ? 'font-medium text-destructive tabular-nums'
                        : 'font-medium text-foreground tabular-nums'
                    }
                  >
                    {next}
                  </span>
                  {invalid ? ' — would violate the reserved/zero floor' : ''}
                </p>
              )
            }}
          </form.Subscribe>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {outcome ? <p className="text-sm text-foreground">{outcome}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {outcome ? 'Close' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !!outcome}>
              {mutation.isPending ? 'Adjusting…' : 'Adjust'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
