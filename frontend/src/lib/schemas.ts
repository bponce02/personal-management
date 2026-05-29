import { z } from 'zod'

// Task create/edit form. `due_date` is an ISO date string (YYYY-MM-DD) or empty.
// `list_id` is optional here: when no lists exist yet, the create mutation
// auto-creates a default list (see useCreateTask), so the form can submit
// without an explicit selection.
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim().optional(),
  due_date: z.string().optional(),
  list_id: z.number().int().positive().optional(),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>

export const listFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
})

export type ListFormValues = z.infer<typeof listFormSchema>

// Pull the first message out of TanStack Form's standard-schema errors, which
// may be plain strings or `{ message }` issue objects.
export function firstError(errors: Array<unknown>): string | undefined {
  for (const e of errors) {
    if (!e) continue
    if (typeof e === 'string') return e
    if (typeof e === 'object' && 'message' in e) {
      const m = (e as { message?: unknown }).message
      if (typeof m === 'string') return m
    }
  }
  return undefined
}
