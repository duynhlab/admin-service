import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createCategory,
  createProduct,
  transitionProduct,
  updateCategory,
  updateProduct,
} from '@/features/catalog/api'
import type { CatalogProduct, Category, LifecycleAction } from '@/features/catalog/api'
import { catalogKeys } from '@/features/catalog/queries'
import { commandErrorText } from '@/lib/command-error'

/**
 * The slice-B catalog commands (RFC-0023). Conventions that matter:
 *  - An edit sends back the version it was loaded with. A 409 VERSION_CONFLICT
 *    is another operator's edit, not a bug, so the dialog says exactly that and
 *    tells the operator to reload rather than retrying blindly.
 *  - A lifecycle command that the product's state does not allow answers 409
 *    INVALID_TRANSITION; same treatment.
 *  - Creates need no idempotency key: the catalog's unique name is the guard,
 *    and a duplicate reads as a conflict the operator can act on.
 */

/** The catalog's subject for the shared command-error copy. */
const productErrorText = (err: unknown) => commandErrorText(err, 'product')

function issueText(err: unknown): string {
  if (typeof err === 'string') return err
  return (err as { message?: string } | null)?.message ?? 'Invalid value'
}

function FieldErrors({ errors }: { errors: Array<unknown> }) {
  return (
    <>
      {errors.map((err, i) => (
        <p key={i} className="text-xs text-destructive">
          {issueText(err)}
        </p>
      ))}
    </>
  )
}

const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or fewer'),
  price: z.number('Enter a price').min(0, 'Price cannot be negative'),
  description: z.string().max(4000, 'Description must be 4000 characters or fewer'),
  category: z.string().max(100, 'Category must be 100 characters or fewer'),
  reason: z.string().max(64, 'Reason must be 64 characters or fewer'),
})

/**
 * One dialog for both create and edit. `product` null means create — which is
 * also why the version only travels on the edit path.
 */
export function ProductFormDialog({
  product,
  onClose,
}: {
  product: CatalogProduct | null | 'new'
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const editing = product !== 'new' && product !== null

  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof productSchema>) =>
      editing
        ? updateProduct(product.id, {
            name: value.name,
            price: value.price,
            description: value.description || undefined,
            category: value.category || undefined,
            version: product.version,
            reason: value.reason || undefined,
          })
        : createProduct({
            name: value.name,
            price: value.price,
            description: value.description || undefined,
            category: value.category || undefined,
          }),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all })
      onClose()
    },
    onError: (err) => setError(productErrorText(err)),
  })

  const form = useForm({
    defaultValues: {
      name: editing ? product.name : '',
      price: editing ? product.price : 0,
      description: editing ? product.description : '',
      category: editing ? product.category : '',
      reason: '',
    },
    validators: { onSubmit: productSchema },
    onSubmit: ({ value }) => mutation.mutate(value),
  })

  if (product === null) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit product' : 'New product'}</DialogTitle>
          <DialogDescription>
            {editing ? (
              <>
                Editing <span className="font-medium">{product.name}</span> at version{' '}
                <span className="tabular-nums">{product.version}</span> — the version travels with
                the save, so a change made elsewhere in the meantime is refused rather than
                overwritten.
              </>
            ) : (
              'New products land in DRAFT and stay out of the public catalog until you publish them.'
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
          <form.Field name="price">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-price">Price</Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min={0}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.valueAsNumber)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
          <form.Field name="category">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-category">Category</Label>
                <Input
                  id="product-category"
                  value={field.state.value}
                  placeholder="Existing category name"
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-description">Description</Label>
                <Input
                  id="product-description"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
          {editing && (
            <form.Field name="reason">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="product-reason">Reason (recorded in the audit trail)</Label>
                  <Input
                    id="product-reason"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldErrors errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : editing ? 'Save' : 'Create draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const ACTION_COPY: Record<LifecycleAction, { title: string; body: string; confirm: string }> = {
  publish: {
    title: 'Publish product',
    body: 'The product becomes visible in the public catalog immediately.',
    confirm: 'Publish',
  },
  archive: {
    title: 'Archive product',
    body: 'The product leaves the public catalog. Carts that already hold it still price correctly — checkout re-validates, so an in-flight order is not broken.',
    confirm: 'Archive',
  },
  restore: {
    title: 'Restore product',
    body: 'The product returns to the public catalog.',
    confirm: 'Restore',
  },
}

/** Confirmation for one lifecycle command, with the reason the audit will keep. */
export function TransitionDialog({
  product,
  action,
  onClose,
}: {
  product: CatalogProduct | null
  action: LifecycleAction
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => transitionProduct(product!.id, action, reason || undefined),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all })
      onClose()
    },
    onError: (err) => setError(productErrorText(err)),
  })

  if (!product) return null
  const copy = ACTION_COPY[action]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{product.name}</span> is currently {product.status}.{' '}
            {copy.body}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transition-reason">Reason (optional, recorded in the audit trail)</Label>
          <Input
            id="transition-reason"
            value={reason}
            maxLength={64}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={action === 'archive' ? 'destructive' : 'default'}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Working…' : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  description: z.string().max(1000, 'Description must be 1000 characters or fewer'),
})

/** One dialog for creating and renaming a category. There is no delete. */
export function CategoryFormDialog({
  category,
  onClose,
}: {
  category: Category | null | 'new'
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const editing = category !== 'new' && category !== null

  const mutation = useMutation({
    mutationFn: (value: z.infer<typeof categorySchema>) =>
      editing
        ? updateCategory(category.id, {
            name: value.name,
            description: value.description || undefined,
          })
        : createCategory({ name: value.name, description: value.description || undefined }),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: catalogKeys.all })
      onClose()
    },
    onError: (err) => setError(productErrorText(err)),
  })

  const form = useForm({
    defaultValues: {
      name: editing ? category.name : '',
      description: editing ? category.description : '',
    },
    validators: { onSubmit: categorySchema },
    onSubmit: ({ value }) => mutation.mutate(value),
  })

  if (category === null) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Rename category' : 'New category'}</DialogTitle>
          <DialogDescription>
            Category names are unique. Deleting one is not offered: products point at categories
            with ON DELETE SET NULL, so a delete would silently uncategorize them.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category-description">Description</Label>
                <Input
                  id="category-description"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
