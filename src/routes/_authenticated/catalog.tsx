import { createFileRoute } from '@tanstack/react-router'
import { CircleDashed } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/catalog')({
  component: () => (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Catalog</h1>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <CircleDashed className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Waiting for its API slice</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Products and categories ship with product-service&apos;s slice B protected
          routes (lifecycle commands, category endpoints) — the portal never mocks data.
        </p>
      </div>
    </div>
  ),
})
