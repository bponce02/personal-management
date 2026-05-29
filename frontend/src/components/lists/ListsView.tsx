import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Alert,
  Button,
  Label,
  ListBox,
  SearchField,
  Select,
  Spinner,
  Typography,
  toast,
} from '@heroui/react'
import { ArrowUpDown, ListChecks, Trash2, X } from 'lucide-react'
import { useBulkDeleteLists, useLists, useTasks } from '../../lib/queries'
import type { List } from '../../lib/tasks-api'
import { Fab } from '../common/Fab'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { ListCard } from './ListCard'
import { CreateListDialog } from './CreateListDialog'
import { ListSettingsDialog } from './ListSettingsDialog'

type SortKey = 'name' | 'count'

// Shared options so the desktop (labeled) and mobile (icon-only) Sort selects
// stay in sync.
function SortOptions() {
  return (
    <ListBox>
      <ListBox.Item id="name" textValue="Name">
        Name
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item id="count" textValue="Task count">
        Task count
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  )
}

export function ListsView() {
  const navigate = useNavigate()
  const listsQuery = useLists()
  const tasksQuery = useTasks()
  const lists = listsQuery.data ?? []

  const counts = useMemo(() => {
    const m = new Map<number, number>()
    for (const t of tasksQuery.data ?? []) m.set(t.list_id, (m.get(t.list_id) ?? 0) + 1)
    return m
  }, [tasksQuery.data])

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsList, setSettingsList] = useState<List | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const bulkDelete = useBulkDeleteLists()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const result = lists.filter((l) => !q || l.title.toLowerCase().includes(q))
    return [...result].sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
    )
  }, [lists, search, sort, counts])

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

  function openSettings(list: List) {
    setSettingsList(list)
    setSettingsOpen(true)
  }

  async function handleBulkDelete() {
    const ids = [...selected]
    try {
      await bulkDelete.mutateAsync(ids)
      toast.success(`Deleted ${ids.length} list${ids.length === 1 ? '' : 's'}`)
      setBulkDeleteOpen(false)
      exitSelectMode()
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : 'Could not delete lists.')
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Toolbar: full labeled controls on desktop, icon-only on mobile */}
      <div className="flex items-end gap-2 md:gap-3">
        <SearchField
          fullWidth
          value={search}
          onChange={setSearch}
          aria-label="Search lists"
          className="min-w-0 flex-1"
        >
          <Label>Search</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input className="min-w-0" placeholder="Search lists" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {/* Desktop controls */}
        <div className="hidden shrink-0 items-end gap-3 md:flex">
          <Select
            value={sort}
            onChange={(key) => setSort((key as SortKey) ?? 'name')}
            className="w-48"
          >
            <Label>Sort by</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <SortOptions />
            </Select.Popover>
          </Select>

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
            aria-label="Sort by"
            variant="secondary"
            value={sort}
            onChange={(key) => setSort((key as SortKey) ?? 'name')}
          >
            <Select.Trigger className="flex size-10 items-center justify-center rounded-3xl p-0">
              <ArrowUpDown className="size-5" />
            </Select.Trigger>
            <Select.Popover>
              <SortOptions />
            </Select.Popover>
          </Select>

          <Button
            isIconOnly
            variant={selectMode ? 'primary' : 'secondary'}
            onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            aria-label={selectMode ? 'Done selecting' : 'Select lists'}
          >
            <ListChecks />
          </Button>
        </div>
      </div>

      {selectMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
          <Typography weight="medium">{selected.size} selected</Typography>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
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

      {listsQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : listsQuery.isError ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Could not load lists</Alert.Title>
            <Alert.Description>
              {listsQuery.error instanceof Error ? listsQuery.error.message : 'Please try again.'}
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => listsQuery.refetch()}>
            Retry
          </Button>
        </Alert>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12">
          <Typography color="muted">
            {lists.length === 0 ? 'No lists yet.' : 'No lists match your search.'}
          </Typography>
          {lists.length === 0 && (
            <Typography type="body-sm" color="muted">
              Tap the + button to create one.
            </Typography>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              taskCount={counts.get(list.id) ?? 0}
              selectMode={selectMode}
              isSelected={selected.has(list.id)}
              onToggleSelect={toggleSelect}
              onOpen={(l) =>
                navigate({ to: '/lists/$listId', params: { listId: String(l.id) } })
              }
              onSettings={openSettings}
            />
          ))}
        </div>
      )}

      <Fab label="New list" onPress={() => setCreateOpen(true)} />

      <CreateListDialog isOpen={createOpen} onOpenChange={setCreateOpen} />

      <ListSettingsDialog
        list={settingsList}
        isOpen={settingsOpen}
        onOpenChange={setSettingsOpen}
        onDeleted={() => setSettingsOpen(false)}
      />

      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Delete selected lists?"
        description={`${selected.size} list${selected.size === 1 ? '' : 's'} and all of their tasks will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
        isPending={bulkDelete.isPending}
      />
    </div>
  )
}
