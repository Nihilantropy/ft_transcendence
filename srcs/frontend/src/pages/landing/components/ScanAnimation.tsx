import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bird, Cat, Dog, Fish, Rabbit, Rat, Scan, Turtle } from 'lucide-react'
import { useEffect, useState } from 'react'

// set of animal icons to cycle through in the animation
const ANIMALS = [Dog, Cat, Rabbit, Turtle, Fish, Bird, Rat] as const
// milliseconds each animal stays on screen
const STEP_MS = 2500

interface ScanAnimationProps {
  size?: number
  className?: string
}

// landing page animation component
// cycles through a set of animal icons inside a scanning frame, with a horizontal scan line traveling up and down
export function ScanAnimation({ size = 140, className }: ScanAnimationProps) {
  const [index, setIndex] = useState(0)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % ANIMALS.length)
    }, STEP_MS)
    return () => {
      window.clearInterval(id)
    }
  }, [reducedMotion])

  const AnimalIcon = ANIMALS[index] ?? ANIMALS[0]

  return (
    <div
      className={`relative ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Scan className="text-accent absolute inset-0" size={size} strokeWidth={1.25} />

      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.85, filter: 'blur(8px)' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <AnimalIcon className="text-accent" size={size * 0.48} strokeWidth={1.5} />
        </motion.div>
      </AnimatePresence>

      {!reducedMotion && (
        <motion.div
          className="bg-accent/75 pointer-events-none absolute right-[18%] left-[18%] h-[5px] rounded-full"
          style={{ boxShadow: '0 0 22px var(--c-accent-glow)' }}
          initial={{ top: '22%' }}
          animate={{ top: ['22%', '78%', '22%'] }}
          transition={{ duration: 3.6, ease: 'easeInOut', repeat: Infinity }}
        />
      )}
    </div>
  )
}
