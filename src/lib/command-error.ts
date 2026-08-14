import { ApiError } from '@/lib/api'

/**
 * Turns the platform's error envelope into a sentence an operator can act on.
 *
 * The refusals a privileged command hits are mostly not bugs — another operator
 * got there first, the state moved, the same decision was already recorded — so
 * each one says what happened AND what to do next. Retrying blindly is the wrong
 * instinct for every code here, and the copy exists to head that off.
 *
 * `subject` names the thing being acted on ("product", "order") so one function
 * serves every feature without the message reading generic.
 */
export function commandErrorText(err: unknown, subject = 'record'): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'VERSION_CONFLICT':
        return `Someone else changed this ${subject} since you opened it. Close, reload, and decide again with what you see then.`
      case 'INVALID_TRANSITION':
        return `That move is not available from this ${subject}'s current state (${err.message}).`
      case 'IDEMPOTENCY_CONFLICT':
        return `This ${subject} and version were already resolved to a different outcome. Reload to see what was recorded.`
      case 'CONFLICT':
        return `A record with that name already exists (${err.message}).`
      case 'FORBIDDEN':
        return 'Your account is not allowed to run this command.'
      default:
        return `${err.message} (${err.code})`
    }
  }
  return 'The command did not reach the service — nothing was changed.'
}
