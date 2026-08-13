import { createFileRoute } from '@tanstack/react-router'
import { AwaitingApi } from '@/components/awaiting-api'

export const Route = createFileRoute('/_authenticated/catalog')({
  component: () => (
    <AwaitingApi
      title="Catalog"
      detail="Products and categories ship with product-service's slice B protected routes (lifecycle commands, category endpoints)."
    />
  ),
})
