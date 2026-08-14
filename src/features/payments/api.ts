import { apiFetch } from '@/lib/api'
import type { Paginated } from '@/lib/api'

/** Typed client for payment's protected reads (homelab docs/api/payments.md). */

export const PAYMENT_STATUSES = [
  'pending', 'authorized', 'captured', 'voided',
  'expired', 'failed', 'processing', 'refunded',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export interface Payment {
  id: number
  user_id: string
  order_id?: number
  amount_minor: number
  currency: string
  status: PaymentStatus
  capture_method: string
  payment_method: string
  provider_payment_id?: string
  decline_code?: string
  created_at: string
}

export interface PaymentAttempt {
  ID: number
  PaymentID: number
  Operation: string
  Outcome: string
  ProviderRef: string
  ProviderStatus: string
}

export interface LedgerTransaction {
  id: number
  kind: string
  external_ref: string
  amount_minor: number
  created_at: string
}

export interface ReconRun {
  id: number
  status: string
  transactions_scanned: number
  discrepancies_found: number
  started_at: string
  finished_at: string | null
}

export interface ReconDiscrepancy {
  id: number
  run_id: number
  provider_payment_id: string
  class: string
  internal_amount_minor: number
  provider_amount_minor: number
  internal_status: string
  provider_status: string
  detail: string
}

export function listPayments(
  q: { page: number; page_size: number; status?: PaymentStatus },
  signal?: AbortSignal,
) {
  return apiFetch<Paginated<Payment>>('/payment/v1/protected/payments', {
    query: { page: q.page, page_size: q.page_size, status: q.status },
    signal,
  })
}

export function getPaymentCase(id: number, signal?: AbortSignal) {
  return apiFetch<{ payment: Payment; attempts: PaymentAttempt[] | null; ledger: LedgerTransaction[] }>(
    `/payment/v1/protected/payments/${id}`,
    { signal },
  )
}

export function listReconRuns(q: { page: number; page_size: number }, signal?: AbortSignal) {
  return apiFetch<Paginated<ReconRun>>('/payment/v1/protected/reconciliations/runs', {
    query: { page: q.page, page_size: q.page_size },
    signal,
  })
}

export function getReconRun(id: number, signal?: AbortSignal) {
  return apiFetch<{ run: ReconRun; discrepancies: ReconDiscrepancy[] }>(
    `/payment/v1/protected/reconciliations/runs/${id}`,
    { signal },
  )
}
