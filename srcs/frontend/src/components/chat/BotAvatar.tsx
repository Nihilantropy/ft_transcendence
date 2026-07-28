import { Bot } from 'lucide-react'

// SmartBreeds AI avatar
export function BotAvatar() {
  return (
    <div className="bg-accent/12 flex h-9 w-9 items-center justify-center rounded-full" aria-hidden>
      <Bot size={18} className="text-accent" aria-hidden />
    </div>
  )
}
