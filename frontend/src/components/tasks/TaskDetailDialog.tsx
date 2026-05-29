import { useState } from 'react'
import { Button, Chip, Modal, Typography, toast } from '@heroui/react'
import { Pencil, Trash2 } from 'lucide-react'
import { useDeleteTask } from '../../lib/queries'
import type { Task } from '../../lib/tasks-api'
import { ConfirmDialog } from '../common/ConfirmDialog'

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD; anchor to local midnight to avoid timezone drift.
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Typography type="body-xs" color="muted">
        {label}
      </Typography>
      {children}
    </div>
  )
}

export function TaskDetailDialog({
  task,
  listName,
  isOpen,
  onOpenChange,
  onEdit,
  onDeleted,
}: {
  task: Task | null
  listName?: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (task: Task) => void
  onDeleted: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const deleteTask = useDeleteTask()

  async function handleDelete() {
    if (!task) return
    try {
      await deleteTask.mutateAsync(task.id)
      toast.success('Task deleted')
      setConfirmOpen(false)
      onDeleted()
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Could not delete the task.')
    }
  }

  return (
    <>
      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{task?.title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {task && (
                  <div className="flex flex-col gap-4">
                    {task.description && (
                      <Field label="Description">
                        <Typography>{task.description}</Typography>
                      </Field>
                    )}
                    <Field label="Due date">
                      <Typography color={task.due_date ? 'default' : 'muted'}>
                        {task.due_date ? formatDate(task.due_date) : 'No due date'}
                      </Typography>
                    </Field>
                    <Field label="List">
                      <div>
                        <Chip size="sm">{listName ?? 'Unknown'}</Chip>
                      </div>
                    </Field>
                    <Field label="Status">
                      <div>
                        <Chip size="sm" color={task.completed ? 'success' : 'default'}>
                          {task.completed ? 'Completed' : 'Active'}
                        </Chip>
                      </div>
                    </Field>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => task && onEdit(task)}>
                  <Pencil />
                  Edit
                </Button>
                <Button variant="danger" onPress={() => setConfirmOpen(true)}>
                  <Trash2 />
                  Delete
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete task?"
        description={`"${task?.title}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isPending={deleteTask.isPending}
      />
    </>
  )
}
