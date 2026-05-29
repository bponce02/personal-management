import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  Spinner,
  TextField,
  toast,
} from '@heroui/react'
import { useForm } from '@tanstack/react-form'
import { useCreateList } from '../../lib/queries'
import { firstError, listFormSchema } from '../../lib/schemas'
import type { ListFormValues } from '../../lib/schemas'

export function CreateListDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>New list</Modal.Heading>
            </Modal.Header>
            {isOpen && <CreateListForm onClose={() => onOpenChange(false)} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

function CreateListForm({ onClose }: { onClose: () => void }) {
  const createList = useCreateList()

  const form = useForm({
    defaultValues: { title: '' } as ListFormValues,
    validators: { onChange: listFormSchema },
    onSubmit: async ({ value }) => {
      try {
        await createList.mutateAsync(value.title)
        toast.success('List created')
        onClose()
      } catch (err) {
        toast.danger(err instanceof Error ? err.message : 'Could not create the list.')
      }
    },
  })

  return (
    <Form
      validationBehavior="aria"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <Modal.Body>
        <form.Field name="title">
          {(field) => (
            <TextField
              isRequired
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              isInvalid={field.state.meta.errors.length > 0}
            >
              <Label>List title</Label>
              <Input placeholder="e.g. Groceries" autoFocus />
              {field.state.meta.errors.length > 0 && (
                <FieldError>{firstError(field.state.meta.errors)}</FieldError>
              )}
            </TextField>
          )}
        </form.Field>
      </Modal.Body>
      <Modal.Footer>
        <Button slot="close" type="button" variant="secondary">
          Cancel
        </Button>
        <form.Subscribe
          selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" isDisabled={!canSubmit} isPending={isSubmitting}>
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : null}
                  Create
                </>
              )}
            </Button>
          )}
        </form.Subscribe>
      </Modal.Footer>
    </Form>
  )
}
