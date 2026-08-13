import { createFileRoute } from '@tanstack/react-router'
import { AwaitingApi } from '@/components/awaiting-api'

export const Route = createFileRoute('/_authenticated/payments')({
  component: () => (
    <AwaitingApi
      title="Payments"
      detail="Payment lists, attempts, ledger summaries, and reconciliation runs ship with payment-service's protected reads (slice A)."
    />
  ),
})
