import { createFileRoute } from '@tanstack/react-router'
import { AwaitingApi } from '@/components/awaiting-api'

export const Route = createFileRoute('/_authenticated/shipments')({
  component: () => (
    <AwaitingApi
      title="Shipments"
      detail="The shipment list and detail views ship with shipping-service's protected reads (slice A)."
    />
  ),
})
