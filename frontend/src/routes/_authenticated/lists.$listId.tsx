import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button, Typography } from '@heroui/react'
import { ChevronLeft } from 'lucide-react'
import { useLists } from '../../lib/queries'
import { TasksView } from '../../components/tasks/TasksView'

export const Route = createFileRoute('/_authenticated/lists/$listId')({
  component: ListDetailPage,
})

function ListDetailPage() {
  const { listId } = Route.useParams()
  const navigate = useNavigate()
  const id = Number(listId)
  const { data: lists } = useLists()
  const list = lists?.find((l) => l.id === id)

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center gap-2">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label="Back to lists"
          onPress={() => navigate({ to: '/lists' })}
        >
          <ChevronLeft />
        </Button>
        <Typography type="h2">{list?.title ?? 'List'}</Typography>
      </div>
      <TasksView listId={id} />
    </div>
  )
}
