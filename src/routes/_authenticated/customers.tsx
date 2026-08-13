import { createFileRoute } from '@tanstack/react-router'
import { AwaitingApi } from '@/components/awaiting-api'

export const Route = createFileRoute('/_authenticated/customers')({
  component: () => (
    <AwaitingApi
      title="Customers"
      detail="Customer search (name, phone, user id) and operator-safe detail ship with user-service's protected reads (slice A)."
    />
  ),
})
