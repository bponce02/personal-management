import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
} from '@heroui/react'
import { CheckSquare } from 'lucide-react'
import { auth } from '../lib/auth'
import { useLogin } from '../lib/auth-hooks'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    if (auth.isAuthenticated()) {
      throw redirect({ to: '/tasks' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    login.mutate({ username, password })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <Card.Header className="items-center">
          <CheckSquare className="size-6" />
          <Card.Title>Sign in</Card.Title>
        </Card.Header>
        <Form onSubmit={handleSubmit}>
          <Card.Content className="flex flex-col gap-4">
            <TextField
              isRequired
              value={username}
              onChange={setUsername}
              autoComplete="username"
            >
              <Label>Username</Label>
              <Input variant="secondary" />
            </TextField>
            <TextField
              isRequired
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            >
              <Label>Password</Label>
              <Input variant="secondary" />
            </TextField>
            {login.isError && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{login.error.message}</Alert.Title>
                </Alert.Content>
              </Alert>
            )}
          </Card.Content>
          <Card.Footer className="mt-4">
            <Button type="submit" isPending={login.isPending} fullWidth>
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : null}
                  Sign in
                </>
              )}
            </Button>
          </Card.Footer>
        </Form>
      </Card>
    </div>
  )
}
