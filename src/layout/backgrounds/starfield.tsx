'use client'

import { useEffect, useRef } from 'react'

export default function StarfieldBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const script = document.createElement('script')
    script.src = '/starfield.js'
    script.async = true
    script.onload = () => {
      const Starfield = (window as any).Starfield
      if (Starfield) {
        Starfield.setup({
          container,
          auto: false,
          originX: window.innerWidth / 2,
          originY: window.innerHeight / 2,
          numStars: 300,
          baseSpeed: 0.3,
          trailLength: 0.4,
          starColor: 'rgb(230, 230, 100)',
          canvasColor: 'rgb(0, 0, 0)',
          hueJitter: 40,
          maxAcceleration: 2,
          accelerationRate: 0.05,
          decelerationRate: 0.02,
          minSpawnRadius: 50,
          maxSpawnRadius: 600,
        })
        container.style.position = 'fixed'
        Starfield.resize(window.innerWidth, window.innerHeight)
        Starfield.setAccelerate(true)

        const handleClick = (e: MouseEvent) => {
          Starfield.setOrigin(e.clientX, e.clientY)
        }
        container.addEventListener('click', handleClick)

        const handleMouseMove = (e: MouseEvent) => {
          Starfield.setOrigin(e.clientX, e.clientY)
        }
        document.addEventListener('mousemove', handleMouseMove)

        ;(window as any).__starfieldCleanup = () => {
          container.removeEventListener('click', handleClick)
          document.removeEventListener('mousemove', handleMouseMove)
        }
      }
    }
    document.body.appendChild(script)

    return () => {
      const Starfield = (window as any).Starfield
      if (Starfield) {
        Starfield.cleanup()
      }
      if (typeof (window as any).__starfieldCleanup === 'function') {
        ;(window as any).__starfieldCleanup()
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className='fixed inset-0 z-0 h-full w-full'
    />
  )
}
