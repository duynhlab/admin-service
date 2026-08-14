/** Query-key root for every catalog read, so one command invalidates them all. */
export const catalogKeys = { all: ['catalog'] as const }
