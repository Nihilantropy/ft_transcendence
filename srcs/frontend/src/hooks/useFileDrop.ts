import { useState, type DragEvent } from 'react'

interface FileDropHandlers {
  onDrop: (e: DragEvent<HTMLElement>) => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDragLeave: (e: DragEvent<HTMLElement>) => void
}

// drop-zone behaviour for a container element: spread 'dropHandlers' on it,
// style it with 'isDragging', receive the dropped file via 'onFile'
export function useFileDrop(onFile: (file: File) => void): {
  isDragging: boolean
  dropHandlers: FileDropHandlers
} {
  const [isDragging, setIsDragging] = useState(false)

  const dropHandlers: FileDropHandlers = {
    onDrop: (e) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    onDragOver: (e) => {
      e.preventDefault()
      if (!isDragging) setIsDragging(true)
    },
    onDragLeave: (e) => {
      // ignore leave events fired while moving across child elements
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      setIsDragging(false)
    },
  }

  return { isDragging, dropHandlers }
}
