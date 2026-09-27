import Illustration from './Illustration'

// Five winged cats crossing the page behind everything. Negative delays: the sky is already
// populated on first paint. Durations are long so the motion stays calm.
const CATS = [
  { top: '8%', size: 64, duration: 70, delay: 0 },
  { top: '30%', size: 44, duration: 85, delay: 30 },
  { top: '52%', size: 56, duration: 64, delay: 50 },
  { top: '70%', size: 36, duration: 90, delay: 12 },
  { top: '86%', size: 48, duration: 76, delay: 40 },
]

export default function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      {CATS.map((c, i) => (
        <div key={i} className="sky-cat"
          style={{ top: c.top, width: c.size, animationDuration: `${c.duration}s`, animationDelay: `-${c.delay}s` }}>
          <div className="sky-bob" style={{ animationDelay: `-${i * 0.7}s` }}>
            <Illustration name="flyingCat" className="w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
