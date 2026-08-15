/**
 * One root key for the orders slice, matching `catalogKeys`. A resolve changes
 * the case, the list, and the dashboard's parked-order count, so invalidating
 * the root is both simplest and correct.
 */
export const ordersKeys = { all: ['orders'] as const }
