import {
  Button,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { useForm } from '@tanstack/react-form'
import { useCreateTask, useUpdateTask } from '../../lib/queries'
import { firstError, taskFormSchema } from '../../lib/schemas'
import type { TaskFormValues } from '../../lib/schemas'
import type { List, Task } from '../../lib/tasks-api'
import { DueDatePicker } from '../common/DueDatePicker'

export function TaskFormDrawer({
  isOpen,
  onOpenChange,
  task,
  lists,
  defaultListId,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  task?: Task
  lists: Array<List>
  defaultListId?: number
}) {
  return (
    <Drawer>
      <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog>
            <Drawer.Handle />
            {isOpen && (
              <TaskFormContents
                key={task?.id ?? 'new'}
                task={task}
                lists={lists}
                defaultListId={defaultListId}
                onClose={() => onOpenChange(false)}
              />
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  )
}

function TaskFormContents({
  task,
  lists,
  defaultListId,
  onClose,
}: {
  task?: Task
  lists: Array<List>
  defaultListId?: number
  onClose: () => void
}) {
  const isEdit = Boolean(task)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  const form = useForm({
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      due_date: task?.due_date ?? '',
      list_id: task?.list_id ?? defaultListId ?? lists[0]?.id,
    } as TaskFormValues,
    validators: { onChange: taskFormSchema },
    onSubmit: async ({ value }) => {
      try {
        if (task) {
          await updateTask.mutateAsync({
            id: task.id,
            patch: {
              title: value.title,
              description: value.description || null,
              due_date: value.due_date || null,
              list_id: value.list_id,
            },
          })
          toast.success('Task updated')
        } else {
          await createTask.mutateAsync({
            title: value.title,
            description: value.description,
            due_date: value.due_date,
            list_id: value.list_id,
          })
          toast.success('Task created')
        }
        onClose()
      } catch (err) {
        toast.danger(err instanceof Error ? err.message : 'Could not save the task.')
      }
    },
  })

  return (
    <>
      <Drawer.Header>
        <Drawer.Heading>{isEdit ? 'Edit task' : 'New task'}</Drawer.Heading>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          validationBehavior="aria"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4 pb-2"
        >
          <form.Field name="title">
            {(field) => (
              <TextField
                isRequired
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                isInvalid={field.state.meta.errors.length > 0}
              >
                <Label>Title</Label>
                <Input placeholder="What needs doing?" />
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{firstError(field.state.meta.errors)}</FieldError>
                )}
              </TextField>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <TextField
                value={field.state.value ?? ''}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              >
                <Label>Description</Label>
                <TextArea placeholder="Add more detail (optional)" />
              </TextField>
            )}
          </form.Field>

          <form.Field name="due_date">
            {(field) => (
              <DueDatePicker
                value={field.state.value || undefined}
                onChange={(v) => field.handleChange(v ?? '')}
              />
            )}
          </form.Field>

          <form.Field name="list_id">
            {(field) => (
              <Select
                isRequired
                placeholder="Select a list"
                value={field.state.value != null ? String(field.state.value) : null}
                onChange={(key) =>
                  field.handleChange(key != null ? Number(key) : undefined)
                }
                isInvalid={field.state.meta.errors.length > 0}
              >
                <Label>List</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                {lists.length === 0 && (
                  <Description>A default list will be created.</Description>
                )}
                <Select.Popover>
                  <ListBox>
                    {lists.map((list) => (
                      <ListBox.Item key={list.id} id={String(list.id)} textValue={list.title}>
                        {list.title}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}
          </form.Field>

          <form.Subscribe
            selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <div className="flex justify-end gap-2 pt-2">
                <Button slot="close" type="button" variant="secondary">
                  Cancel
                </Button>
                <Button type="submit" isDisabled={!canSubmit} isPending={isSubmitting}>
                  {({ isPending }) => (
                    <>
                      {isPending ? <Spinner color="current" size="sm" /> : null}
                      {isEdit ? 'Save changes' : 'Create task'}
                    </>
                  )}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </Form>
      </Drawer.Body>
    </>
  )
}
