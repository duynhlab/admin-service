import { createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { DetailHeader, DetailStates, Field, FieldGrid } from '@/components/detail'
import { getCustomer } from '@/features/customers/api'

export const Route = createFileRoute('/_authenticated/customers_/$userId')({
  component: CustomerPage,
})

const customerQuery = (userId: string) =>
  queryOptions({
    queryKey: ['customers', 'detail', userId] as const,
    queryFn: ({ signal }) => getCustomer(userId, signal),
  })

function CustomerPage() {
  const { userId } = Route.useParams()
  const query = useQuery(customerQuery(userId))
  const c = query.data

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        backTo="/customers"
        backLabel="Customers"
        title={c?.name || 'Customer'}
      />
      <DetailStates
        isPending={query.isPending}
        error={query.error}
        notFoundMessage="No profile for this subject — the account may exist only in Keycloak."
      >
        {c && (
          <>
            <FieldGrid>
              <Field label="Subject"><span className="font-mono text-xs">{c.user_id}</span></Field>
              <Field label="Phone">{c.phone || '—'}</Field>
              <Field label="Address">{c.address || '—'}</Field>
              <Field label="Since">{c.created_at}</Field>
              <Field label="Updated">{c.updated_at}</Field>
            </FieldGrid>
            <p className="text-xs text-muted-foreground">
              Identity claims (email, username, credentials) live in Keycloak — this is
              the profile record only (ADR-050).
            </p>
          </>
        )}
      </DetailStates>
    </div>
  )
}
