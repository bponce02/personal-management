import { useState } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toast } from '@heroui/react'
import appCss from '../styles.css?url'

const THEME_INIT = `(function(){try{var s=localStorage.getItem('theme'),d=s==='light'||s==='dark'?s:window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(d);}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Personal Tasks' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // One client per app instance. Created in state so SSR and the client each get
  // a stable instance and request caches never leak between them.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
      }),
  )

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <QueryClientProvider client={queryClient}>
          {children}
          <Toast.Provider placement="top" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
