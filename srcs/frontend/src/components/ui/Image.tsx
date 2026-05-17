import { cn } from '@/lib/utils'
import { forwardRef, type ImgHTMLAttributes } from 'react'

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'loading'> {
  eager?: boolean
}

// wrapper around <img> with some sensible defaults for better performance and UX
// `loading="eager"` + `fetchpriority="high"` when `eager`, lazy otherwise
// `decoding="async"` so image loading never blocks the main thread
export const Image = forwardRef<HTMLImageElement, ImageProps>(
  ({ eager = false, alt = '', className, draggable = false, ...rest }, ref) => (
    <img
      ref={ref}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      draggable={draggable}
      className={cn(className)}
      {...rest}
    />
  ),
)
Image.displayName = 'Image'
