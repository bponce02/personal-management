import { createFileRoute } from '@tanstack/react-router'
import { Typography } from '@heroui/react'

export const Route = createFileRoute('/_authenticated/calendar')({
  component: CalendarPage,
})

function CalendarPage() {
  return (
    <div className="flex flex-col gap-3 py-6">
      <Typography type="h2">Calendar</Typography>
      <Typography color="muted">This is a work in progress.</Typography>
    </div>
  )
}
