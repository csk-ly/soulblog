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
          // Layer 0: static twinkling stars on dark background
          bgStaticStars: 300,
          bgTwinkleSpeed: 0.0015,
          // Layer 1: slow background starfield (warp stars)
          warpStars: 260,
          warpMaxRadius: 1400,
          warpBaseSpeed: 0.12,
          warpSpeedJitter: 0.06,
          warpSizeBase: 1.3,
          // Layer 2: 3D galaxy at mouse (appears after 1000ms idle)
          galaxyStars: 1100,
          armCount: 4,
          armPitch: 0.42,
          coreRadius: 28,
          armInnerRadius: 60,
          armOuterRadius: 430,
          rotationSpeed: 0.0002,
          galaxyTilt: 1.15,
          galaxyTiltWobble: 0.12,
          galaxyTiltWobbleSpeed: 0.00012,
          coreGlowEnabled: true,
          coreGlowRadius: 110,
          // Layer 3: comet trail (while mouse moving)
          cometMaxParticles: 100,
          cometSpawnRate: 3,
          cometParticleLife: 800,
          cometHeadRadius: 30,
          // State machine
          idleThreshold: 5000,
          fadeSpeed: 0.05,
          // Colors
          starColor: 'rgb(180, 210, 255)',
          canvasColor: 'rgb(2, 2, 8)',
        })
        container.style.position = 'fixed'
        Starfield.resize(window.innerWidth, window.innerHeight)

        const handleMouseMove = (e: MouseEvent) => {
          Starfield.setOrigin(e.clientX, e.clientY)
        }
        const handleResize = () => {
          Starfield.resize(window.innerWidth, window.innerHeight)
        }
        document.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('resize', handleResize)

        ;(window as any).__starfieldCleanup = () => {
          document.removeEventListener('mousemove', handleMouseMove)
          window.removeEventListener('resize', handleResize)
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
