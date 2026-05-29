import { createFileRoute } from '@tanstack/react-router'
import { ListsView } from '../../components/lists/ListsView'

export const Route = createFileRoute('/_authenticated/lists/')({
  component: ListsPage,
})

function ListsPage() {
  return <ListsView />
}
