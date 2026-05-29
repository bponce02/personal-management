import { createFileRoute } from '@tanstack/react-router'
import { TasksView } from '../../components/tasks/TasksView'

export const Route = createFileRoute('/_authenticated/tasks')({
  component: TasksPage,
})

function TasksPage() {
  return <TasksView />
}
