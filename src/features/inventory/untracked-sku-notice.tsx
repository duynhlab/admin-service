import { Link } from '@tanstack/react-router'

/**
 * The ADR-053 warning surface: a product whose SKU has no inventory balance
 * row is unbuyable — checkout answers 409 ITEM_NOT_ORDERABLE until an
 * operator receives first stock. Amber and advisory (the external-truths
 * doctrine): it informs, it never gates. Rendered only when the balances
 * read POSITIVELY answered "no row"; a failed or pending read renders
 * nothing, because absence of the warning must never be read as tracked.
 */
export function UntrackedSkuNotice({ skuId }: { skuId: string }) {
  return (
    <p
      role="status"
      className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-300"
    >
      No inventory balance row exists for SKU{' '}
      <span className="font-mono text-[13px]">{skuId}</span> — shoppers cannot
      order it until stock is received.{' '}
      <Link
        to="/inventory"
        search={{ view: 'balances', page: 1, page_size: 20, sku_id: skuId }}
        className="font-medium underline underline-offset-2"
      >
        Receive first stock
      </Link>
    </p>
  )
}
