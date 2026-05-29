import { Button, Card, Checkbox, Chip, Typography } from '@heroui/react'
import { Check } from 'lucide-react'
import type { Task } from '../../lib/tasks-api'

export function TaskCard({
  task,
  listName,
  selectMode,
  isSelected,
  isToggling,
  onToggleSelect,
  onToggleComplete,
  onOpen,
}: {
  task: Task
  listName?: string
  selectMode: boolean
  isSelected: boolean
  isToggling: boolean
  onToggleSelect: (id: number) => void
  onToggleComplete: (task: Task) => void
  onOpen: (task: Task) => void
}) {
  const activate = () => (selectMode ? onToggleSelect(task.id) : onOpen(task))

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
      className="cursor-pointer"
    >
      <Card>
        <div className="flex items-center gap-3">
          {selectMode && (
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                isSelected={isSelected}
                onChange={() => onToggleSelect(task.id)}
                aria-label={`Select ${task.title}`}
              >
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox>
            </div>
          )}

          <div className="flex flex-1 flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <Typography
                weight="medium"
                truncate
                color={task.completed ? 'muted' : 'default'}
              >
                {task.title}
              </Typography>
              {listName && <Chip size="sm" className="shrink-0">{listName}</Chip>}
            </div>

            <Typography color="muted" className="line-clamp-1 min-h-[1lh]">
              {task.description ?? ''}
            </Typography>
          </div>

          {!selectMode && (
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                isIconOnly
                size="sm"
                variant={task.completed ? 'primary' : 'outline'}
                isPending={isToggling}
                onPress={() => onToggleComplete(task)}
                aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                <Check />
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
