import { ApiError } from '../api'
import { useI18n } from '../i18n'
import Illustration from './Illustration'

export default function ErrorNote({ error }: { error: unknown }) {
  const { errorMessage } = useI18n()
  const code = error instanceof ApiError ? error.code : 'UNKNOWN'
  if (code === 'NETWORK_ERROR') {
    // Non-blocking: a banner, the page stays usable.
    return <div role="alert" className="rounded-2xl bg-accent/10 px-4 py-3">{errorMessage(code)}</div>
  }
  return (
    <div role="alert" className="flex flex-col items-center gap-2 text-center">
      <Illustration name="error" className="h-24 w-24 text-accent" />
      <p>{errorMessage(code)}</p>
    </div>
  )
}
