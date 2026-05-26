'use client'

import { useEffect, useRef, useState, RefObject, useCallback } from 'react'

interface UseIntersectionObserverOptions {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
}

interface UseIntersectionObserverReturn<T extends HTMLElement> {
  ref: RefObject<T | null>
  isIntersecting: boolean
  hasAnimated: boolean
}

export function useIntersectionObserver<T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverReturn<T> {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', triggerOnce = true } = options
  const ref = useRef<T | null>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isCurrentlyIntersecting = entry.isIntersecting

        if (triggerOnce) {
          if (isCurrentlyIntersecting && !hasAnimated) {
            setIsIntersecting(true)
            setHasAnimated(true)
            observer.unobserve(element)
          }
        } else {
          setIsIntersecting(isCurrentlyIntersecting)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [threshold, rootMargin, triggerOnce, hasAnimated])

  return { ref, isIntersecting, hasAnimated }
}
