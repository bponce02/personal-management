import { useMemo, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  Alert,
  Button,
  Label,
  ListBox,
  SearchField,
  Select,
  Separator,
  Spinner,
  Typography,
  toast,
} from '@heroui/react'
import {
  CheckCheck,
  CheckCircle2,
  Copy,
  Filter,
  List as ListIcon,
  ListChecks,
  Trash2,
  X,
} from 'lucide-react'
import {
  useBulkDeleteTasks,
  useBulkDuplicateTasks,
  useBulkUpdateTasks,
  useLists,
  useTasks,
  useUpdateTask,
} from '../../lib/queries'
import type { List, Task } from '../../lib/tasks-api'
import { Fab } from '../common/Fab'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { TaskCard } from './TaskCard'
import { TaskDetailDialog } from './TaskDetailDialog'
import { TaskFormDrawer } from './TaskFormDrawer'

type StatusFilter = 'all' | 'active' | 'completed'

// Shared option lists so the desktop (labeled) and mobile (icon-only) Selects
// stay in sync.
function StatusOptions() {
  return (
    <ListBox>
      <ListBox.Item id="all" textValue="All">
        All
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item id="active" textValue="Active">
        Active
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item id="completed" textValue="Completed">
        Completed
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  )
}

function ListOptions({ lists }: { lists: Array<List> }) {
  return (
    <ListBox>
      <ListBox.Item id="all" textValue="All lists">
        All lists
        <ListBox.ItemIndicator />
      </ListBox.Item>
      {lists.map((list) => (
        <ListBox.Item key={list.id} id={String(list.id)} textValue={list.title}>
          {list.title}
          <ListBox.ItemIndicator />
        </ListBox.Item>
      ))}
    </ListBox>
  )
}

export function TasksView({ listId }: { listId?: number }) {
  const listsQuery = useLists()
  const tasksQuery = useTasks(listId)
  const lists = listsQuery.data ?? []
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [listFilter, setListFilter] = useState<string>('all')

  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const [togglingId, setTogglingId] = useState<number | null>(null)
  const updateTask = useUpdateTask()

  function fireConfetti() {
    confetti({
      particleCount: 120,
      spread: 160,
      startVelocity: 30,
      gravity: 0.8,
      origin: { x: 0.5, y: 0 },
      zIndex: 9999,
    })
  }

  const bulkUpdate = useBulkUpdateTasks()
  const bulkDelete = useBulkDeleteTasks()
  const bulkDuplicate = useBulkDuplicateTasks()

  const tasks = tasksQuery.data ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (status === 'active' && t.completed) return false
      if (status === 'completed' && !t.completed) return false
      if (!listId && listFilter !== 'all' && t.list_id !== Number(listFilter)) return false
      if (q) {
        const hay = `${t.title} ${t.description ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tasks, search, status, listFilter, listId])

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function handleToggleComplete(task: Task) {
    if (!task.completed) fireConfetti()
    setTogglingId(task.id)
    try {
      await updateTask.mutateAsync({ id: task.id, patch: { completed: !task.completed } })
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Could not update the task.')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleBulkComplete() {
    const ids = [...selected]
    try {
      await bulkUpdate.mutateAsync({ ids, patch: { completed: true } })
      toast.success(`Marked ${ids.length} task${ids.length === 1 ? '' : 's'} complete`)
      exitSelectMode()
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Could not update tasks.')
    }
  }

  async function handleBulkDuplicate() {
    const sourceTasks = tasks.filter((t) => selected.has(t.id))
    try {
      await bulkDuplicate.mutateAsync(sourceTasks)
      toast.success(`Duplicated ${sourceTasks.length} task${sourceTasks.length === 1 ? '' : 's'}`)
      exitSelectMode()
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Could not duplicate tasks.')
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected]
    try {
      await bulkDelete.mutateAsync(ids)
      toast.success(`Deleted ${ids.length} task${ids.length === 1 ? '' : 's'}`)
      setBulkDeleteOpen(false)
      exitSelectMode()
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Could not delete tasks.')
    }
  }

  function openCreate() {
    setEditingTask(undefined)
    setDrawerOpen(true)
  }

  function openDetail(task: Task) {
    setDetailTask(task)
    setDetailOpen(true)
  }

  function openEdit(task: Task) {
    setDetailOpen(false)
    setEditingTask(task)
    setDrawerOpen(true)
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Toolbar: full labeled controls on desktop, icon-only on mobile */}
      <div className="flex items-end gap-2 md:gap-3">
        <SearchField
          fullWidth
          value={search}
          onChange={setSearch}
          aria-label="Search tasks"
          className="min-w-0 flex-1"
        >
          <Label>Search</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input className="min-w-0" placeholder="Search title or description" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {/* Desktop controls */}
        <div className="hidden shrink-0 items-end gap-3 md:flex">
          <Select
            value={status}
            onChange={(key) => setStatus(key as StatusFilter)}
            className="w-44"
          >
            <Label>Status</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <StatusOptions />
            </Select.Popover>
          </Select>

          {!listId && (
            <Select
              value={listFilter}
              onChange={(key) => setListFilter(key as string)}
              className="w-48"
            >
              <Label>List</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListOptions lists={lists} />
              </Select.Popover>
            </Select>
          )}

          <Button
            variant={selectMode ? 'primary' : 'secondary'}
            onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          >
            <ListChecks />
            {selectMode ? 'Done' : 'Select'}
          </Button>
        </div>

        {/* Mobile controls: icon-only, aligned with the search bar */}
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <Select
            aria-label="Filter by status"
            variant="secondary"
            value={status}
            onChange={(key) => setStatus(key as StatusFilter)}
          >
            <Select.Trigger className="flex size-10 items-center justify-center rounded-3xl p-0">
              <Filter className="size-5" />
            </Select.Trigger>
            <Select.Popover>
              <StatusOptions />
            </Select.Popover>
          </Select>

          {!listId && (
            <Select
              aria-label="Filter by list"
              variant="secondary"
              value={listFilter}
              onChange={(key) => setListFilter(key as string)}
            >
              <Select.Trigger className="flex size-10 items-center justify-center rounded-3xl p-0">
                <ListIcon className="size-5" />
              </Select.Trigger>
              <Select.Popover>
                <ListOptions lists={lists} />
              </Select.Popover>
            </Select>
          )}

          <Button
            isIconOnly
            variant={selectMode ? 'primary' : 'secondary'}
            onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            aria-label={selectMode ? 'Done selecting' : 'Select tasks'}
          >
            <ListChecks />
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <Typography weight="medium">{selected.size} selected</Typography>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={selected.size === 0}
              isPending={bulkUpdate.isPending}
              onPress={handleBulkComplete}
            >
              <CheckCheck />
              Mark complete
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={selected.size === 0}
              isPending={bulkDuplicate.isPending}
              onPress={handleBulkDuplicate}
            >
              <Copy />
              Duplicate
            </Button>
            <Button
              size="sm"
              variant="danger"
              isDisabled={selected.size === 0}
              isPending={bulkDelete.isPending}
              onPress={() => setBulkDeleteOpen(true)}
            >
              <Trash2 />
              Delete
            </Button>
            <Button size="sm" variant="tertiary" onPress={exitSelectMode}>
              <X />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {tasksQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : tasksQuery.isError ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Could not load tasks</Alert.Title>
            <Alert.Description>
              {tasksQuery.error instanceof Error ? tasksQuery.error.message : 'Please try again.'}
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => tasksQuery.refetch()}>
            Retry
          </Button>
        </Alert>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12">
          <Typography color="muted">
            {tasks.length === 0 ? 'No tasks yet.' : 'No tasks match your filters.'}
          </Typography>
          {tasks.length === 0 && (
            <Typography type="body-sm" color="muted">
              Tap the + button to create one.
            </Typography>
          )}
        </div>
      ) : (() => {
        const active = filtered.filter((t) => !t.completed)
        const completed = filtered.filter((t) => t.completed)
        const renderCard = (task: Task) => (
          <TaskCard
            key={task.id}
            task={task}
            listName={listById.get(task.list_id)?.title}
            selectMode={selectMode}
            isSelected={selected.has(task.id)}
            isToggling={togglingId === task.id}
            onToggleSelect={toggleSelect}
            onToggleComplete={handleToggleComplete}
            onOpen={openDetail}
          />
        )
        return (
          <div className="flex flex-col gap-3">
            {active.map(renderCard)}
            {active.length > 0 && completed.length > 0 && (
              <div className="flex items-center gap-3 py-1">
                <Separator className="flex-1" />
                <div className="flex items-center gap-1.5 text-muted">
                  <CheckCircle2 className="size-3.5" />
                  <Typography type="body-sm" color="muted">Completed</Typography>
                </div>
                <Separator className="flex-1" />
              </div>
            )}
            {completed.map(renderCard)}
          </div>
        )
      })()}

      <Fab label="New task" onPress={openCreate} />

      <TaskFormDrawer
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        task={editingTask}
        lists={lists}
        defaultListId={listId}
      />

      <TaskDetailDialog
        task={detailTask}
        listName={detailTask ? listById.get(detailTask.list_id)?.title : undefined}
        isOpen={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
        onDeleted={() => setDetailOpen(false)}
      />

      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete selected tasks?"
        description={`${selected.size} task${selected.size === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
        isPending={bulkDelete.isPending}
      />
    </div>
  )
}
