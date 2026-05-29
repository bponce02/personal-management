import { useEffect, useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Button, Card, Separator, Switch, Typography } from '@heroui/react'
import { ArrowLeft, LogOut, Moon, Server, Sun } from 'lucide-react'
import { useLogout } from '../../lib/auth-hooks'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return {
    theme,
    toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  }
}

const iosSteps = [
  'Open Settings > Calendar > Accounts',
  'Tap Add Account > Other > Add CalDAV Account',
  "Server: your host's LAN IP and port 5232 (e.g. 192.168.1.x:5232)",
  'Enter your Radicale username and password',
  'Tap Next — tasks appear in Reminders automatically',
]

const androidSteps = [
  'Install DAVx5 from the Play Store',
  'Add account > Login with URL',
  'Base URL: http://192.168.1.x:5232 with your Radicale credentials',
  'Enable the task calendars and sync',
]

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-1.5 pl-1">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-2">
          <Typography
            type="body-sm"
            color="muted"
            className="shrink-0 tabular-nums"
          >
            {i + 1}.
          </Typography>
          <Typography type="body-sm" color="muted">
            {step}
          </Typography>
        </li>
      ))}
    </ol>
  )
}

function SettingsPage() {
  const { theme, toggle } = useTheme()
  const logout = useLogout()
  const router = useRouter()
  const isDark = theme === 'dark'

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          onPress={() => router.history.back()}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Typography type="h2">Settings</Typography>
      </div>

      {/* Appearance */}
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2 text-base">
            {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
            Appearance
          </Card.Title>
        </Card.Header>
        <Separator />
        <Card.Content className="py-4">
          <Switch
            isSelected={isDark}
            onChange={toggle}
            className="w-full justify-between"
          >
            <Switch.Content>
              <Typography weight="medium">Dark mode</Typography>
              <Typography type="body-sm" color="muted">
                Switch between light and dark theme
              </Typography>
            </Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </Card.Content>
      </Card>

      {/* CalDAV sync */}
      {/* <Card>
        <Card.Header>
          <Card.Title className="text-base">Phone sync (CalDAV)</Card.Title>
          <Card.Description>
            Connect your phone to sync tasks via the local Radicale server.
          </Card.Description>
        </Card.Header>
        <Separator />
        <Card.Content className="flex flex-col gap-6 py-4">
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <Server className="mt-0.5 size-4 shrink-0 text-warning" />
            <Typography type="body-sm" color="muted">
              Both your phone and this server must be on the same local network. Use your
              host machine&apos;s LAN IP — not localhost.
            </Typography>
          </div>

          <div className="flex flex-col gap-2">
            <Typography weight="semibold">iOS</Typography>
            <StepList steps={iosSteps} />
          </div>

          <div className="flex flex-col gap-2">
            <Typography weight="semibold">Android</Typography>
            <StepList steps={androidSteps} />
          </div>
        </Card.Content>
      </Card> */}

      {/* Account */}
      <Card>
        <Card.Header>
          <Card.Title className="text-base">Account</Card.Title>
        </Card.Header>
        <Separator />
        <Card.Content className="py-4">
          <Button variant="danger" onPress={logout} className="ml-auto">
            <LogOut className="size-4" />
            Sign out
          </Button>
        </Card.Content>
      </Card>
    </div>
  )
}
