import { createFileRoute, Link } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { DetailHeader, DetailStates, Field, FieldGrid } from '@/components/detail'
import { getShipment } from '@/features/shipments/api'
import type { ShipmentStatus } from '@/features/shipments/api'

export const Route = createFileRoute('/_authenticated/shipments_/$shipmentId')({
  component: ShipmentPage,
})

const shipmentQuery = (id: number) =>
  queryOptions({
    queryKey: ['shipments', 'detail', id] as const,
    queryFn: ({ signal }) => getShipment(id, signal),
  })

const statusVariant = (s: ShipmentStatus) =>
  s === 'cancelled' ? 'destructive' : s === 'delivered' ? 'secondary' : 'outline'

function ShipmentPage() {
  const { shipmentId } = Route.useParams()
  const query = useQuery(shipmentQuery(Number(shipmentId)))
  const s = query.data

  return (
    <div className="flex flex-col gap-4">
      <DetailHeader
        backTo="/shipments"
        backLabel="Shipments"
        title={`Shipment #${shipmentId}`}
        badge={s && <Badge variant={statusVariant(s.status)}>{s.status}</Badge>}
      />
      <DetailStates
        isPending={query.isPending}
        error={query.error}
        notFoundMessage="No shipment with this id."
      >
        {s && (
          <FieldGrid>
            <Field label="Order">
              <Link
                to="/orders/$orderId"
                params={{ orderId: String(s.order_id) }}
                className="underline-offset-2 hover:underline"
              >
                #{s.order_id}
              </Link>
            </Field>
            <Field label="Tracking"><span className="font-mono text-xs">{s.tracking_number}</span></Field>
            <Field label="Carrier">{s.carrier || '—'}</Field>
            <Field label="Estimated delivery">{s.estimated_delivery ?? '—'}</Field>
            <Field label="Created">{s.created_at ?? '—'}</Field>
          </FieldGrid>
        )}
      </DetailStates>
    </div>
  )
}
