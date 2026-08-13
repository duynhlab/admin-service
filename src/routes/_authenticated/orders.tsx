import { createFileRoute } from '@tanstack/react-router'
import { AwaitingApi } from '@/components/awaiting-api'

export const Route = createFileRoute('/_authenticated/orders')({
  component: () => (
    <AwaitingApi
      title="Orders"
      detail="The cross-customer order list and case view ship with order-service's protected reads (slice A)."
    />
  ),
})
