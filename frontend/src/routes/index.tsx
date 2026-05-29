import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { Button, Typography } from '@heroui/react'
import { CheckSquare } from 'lucide-react'
import { auth } from '../lib/auth'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (auth.isAuthenticated()) {
      throw redirect({ to: '/tasks' })
    }
  },
  component: WelcomePage,
})

function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-2xl flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-2xl border p-3">
            <CheckSquare className="size-8" />
          </div>
          <div className="flex flex-col gap-2">
            <Typography type="h1">Personal Management</Typography>
            <Typography color="muted" className="max-w-xs">
              A private, focused workspace for tasks and calendars.
            </Typography>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button size="lg" onPress={() => navigate({ to: '/login' })}>
            Sign in
          </Button>
        </div>
      </div>
    </div>
  )
}
