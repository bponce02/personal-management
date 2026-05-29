import { useEffect, useState } from 'react'
import {
  Button,
  Input,
  Label,
  Modal,
  Separator,
  Spinner,
  TextField,
  Typography,
  toast,
} from '@heroui/react'
import { Trash2 } from 'lucide-react'
import { useDeleteList, useRenameList } from '../../lib/queries'
import type { List } from '../../lib/tasks-api'
import { ConfirmDialog } from '../common/ConfirmDialog'

export function ListSettingsDialog({
  list,
  isOpen,
  onOpenChange,
  onDeleted,
}: {
  list: List | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const [title, setTitle] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const rename = useRenameList()
  const deleteList = useDeleteList()

  useEffect(() => {
    if (isOpen && list) setTitle(list.title)
  }, [isOpen, list])

  const trimmed = title.trim()
  const canRename = trimmed.length > 0 && trimmed !== list?.title

  async function handleRename() {
    if (!list || !canRename) return
    try {
      await rename.mutateAsync({ id: list.id, title: trimmed })
      toast.success('List renamed')
      onOpenChange(false)
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Could not rename the list.')
    }
  }

  async function handleDelete() {
    if (!list) return
    try {
      await deleteList.mutateAsync(list.id)
      toast.success('List deleted')
      setConfirmOpen(false)
      onDeleted()
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Could not delete the list.')
    }
  }

  return (
    <>
      <Modal>
        <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[420px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>List settings</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <TextField value={title} onChange={setTitle}>
                      <Label>Name</Label>
                      <Input placeholder="List name" />
                    </TextField>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        isDisabled={!canRename}
                        isPending={rename.isPending}
                        onPress={handleRename}
                      >
                        {({ isPending }) => (
                          <>
                            {isPending ? <Spinner color="current" size="sm" /> : null}
                            Rename
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <Typography weight="medium">Delete list</Typography>
                      <Typography type="body-sm" color="muted">
                        Removes the list and all of its tasks.
                      </Typography>
                    </div>
                    <Button variant="danger" onPress={() => setConfirmOpen(true)}>
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Close
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete list?"
        description={`"${list?.title}" and all of its tasks will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete list"
        onConfirm={handleDelete}
        isPending={deleteList.isPending}
      />
    </>
  )
}
