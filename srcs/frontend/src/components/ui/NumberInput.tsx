import { Button } from '@/components/ui/Button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { forwardRef, type InputHTMLAttributes } from 'react'

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  // the up / down arrows: the owner decides the step and the bounds
  onStep: (direction: 1 | -1) => void
}

// number field with custom up/down arrows
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ onStep, inputMode = 'numeric', ...rest }, ref) => (
    <div className="border-border-soft focus-within:border-accent focus-within:ring-accent/30 relative flex h-11 w-full items-center rounded-md border bg-transparent transition-colors focus-within:ring-2">
      <input
        ref={ref}
        type="number"
        inputMode={inputMode}
        min={0}
        className="text-text-hi placeholder:text-text-lo h-full w-full bg-transparent px-3 py-2 text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        {...rest}
      />
      <div className="flex h-full flex-col">
        <Button
          variant="naked"
          type="button"
          tabIndex={-1}
          onClick={() => {
            onStep(1)
          }}
          aria-label="Increment"
          className="text-text-mid hover:text-accent flex flex-1 items-end justify-center px-2 transition-colors"
        >
          <ChevronUp size={12} aria-hidden />
        </Button>
        <Button
          variant="naked"
          type="button"
          tabIndex={-1}
          onClick={() => {
            onStep(-1)
          }}
          aria-label="Decrement"
          className="text-text-mid hover:text-accent flex flex-1 items-start justify-center px-2 pt-1 transition-colors"
        >
          <ChevronDown size={12} aria-hidden />
        </Button>
      </div>
    </div>
  ),
)
NumberInput.displayName = 'NumberInput'
