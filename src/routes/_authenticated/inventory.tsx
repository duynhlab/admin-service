import { createFileRoute } from '@tanstack/react-router'
import { AwaitingApi } from '@/components/awaiting-api'

export const Route = createFileRoute('/_authenticated/inventory')({
  component: () => (
    <AwaitingApi
      title="Inventory"
      detail="Balances, movements, reservations, and the receive/adjust commands ship with inventory-service's first HTTP surface (slice A)."
    />
  ),
})
