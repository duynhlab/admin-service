import { queryOptions } from '@tanstack/react-query'
import {
  listBalances,
  listMovements,
  listReservations,
} from '@/features/inventory/api'
import type {
  BalanceListQuery,
  MovementListQuery,
  ReservationListQuery,
} from '@/features/inventory/api'

/**
 * One key factory for the inventory domain (ADR-049): keys embed the
 * validated search object, so URL state IS the cache key. Mutations
 * invalidate `inventoryKeys.all` — a stock command changes balances AND
 * appends to the ledger, so both lists refetch.
 */
export const inventoryKeys = {
  all: ['inventory'] as const,
  balances: (q: BalanceListQuery) => [...inventoryKeys.all, 'balances', q] as const,
  movements: (q: MovementListQuery) => [...inventoryKeys.all, 'movements', q] as const,
  reservations: (q: ReservationListQuery) =>
    [...inventoryKeys.all, 'reservations', q] as const,
}

export const balancesQuery = (q: BalanceListQuery) =>
  queryOptions({
    queryKey: inventoryKeys.balances(q),
    queryFn: ({ signal }) => listBalances(q, signal),
  })

export const movementsQuery = (q: MovementListQuery) =>
  queryOptions({
    queryKey: inventoryKeys.movements(q),
    queryFn: ({ signal }) => listMovements(q, signal),
  })

export const reservationsQuery = (q: ReservationListQuery) =>
  queryOptions({
    queryKey: inventoryKeys.reservations(q),
    queryFn: ({ signal }) => listReservations(q, signal),
  })
