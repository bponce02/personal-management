import { Button, Card, Checkbox, Chip, Typography } from '@heroui/react'
import { Settings } from 'lucide-react'
import type { List } from '../../lib/tasks-api'

export function ListCard({
  list,
  taskCount,
  selectMode,
  isSelected,
  onToggleSelect,
  onOpen,
  onSettings,
}: {
  list: List
  taskCount: number
  selectMode: boolean
  isSelected: boolean
  onToggleSelect: (id: number) => void
  onOpen: (list: List) => void
  onSettings: (list: List) => void
}) {
  const activate = () => (selectMode ? onToggleSelect(list.id) : onOpen(list))

  return (
    <Card>
      <div className="flex items-center gap-3">
        {selectMode && (
          <Checkbox
            isSelected={isSelected}
            onChange={() => onToggleSelect(list.id)}
            aria-label={`Select ${list.title}`}
          >
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox>
        )}

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
          className="flex flex-1 items-center gap-2 text-left"
        >
          <Typography weight="medium">{list.title}</Typography>
          <Chip size="sm">{taskCount}</Chip>
        </div>

        {!selectMode && (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => onSettings(list)}
            aria-label={`Settings for ${list.title}`}
          >
            <Settings />
          </Button>
        )}
      </div>
    </Card>
  )
}
