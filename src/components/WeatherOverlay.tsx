'use client'

import { useEffect, useRef } from 'react'

interface WeatherOverlayProps {
  weather: 'sunny' | 'cloudy' | 'stormy'
}

export default function WeatherOverlay({ weather }: WeatherOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    // Frame-rate monitoring state
    let lastTime = performance.now()
    let frameCount = 0
    let fps = 60
    let fpsCounter = 0
    let runAnimation = true

    // Particle classes
    class SunnyParticle {
      x: number = Math.random() * width
      y: number = Math.random() * height
      size: number = 1 + Math.random() * 2
      alpha: number = Math.random()
      speedX: number = (Math.random() - 0.5) * 0.5
      speedY: number = -0.2 - Math.random() * 0.4
      maxLife: number = 100 + Math.random() * 100
      life: number = 0

      reset() {
        this.x = Math.random() * width
        this.y = height + 10
        this.size = 1 + Math.random() * 2
        this.alpha = Math.random()
        this.speedX = (Math.random() - 0.5) * 0.5
        this.speedY = -0.2 - Math.random() * 0.4
        this.life = 0
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY
        this.life++
        this.alpha = Math.sin((this.life / this.maxLife) * Math.PI) * 0.6
        if (this.y < -10 || this.life >= this.maxLife) {
          this.reset()
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.save()
        c.beginPath()
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        c.fillStyle = `rgba(253, 224, 71, ${this.alpha})` // Yellow-300
        c.shadowBlur = 8
        c.shadowColor = 'rgb(234, 179, 8)'
        c.fill()
        c.restore()
      }
    }

    class CloudyParticle {
      x: number = Math.random() * width
      y: number = Math.random() * (height * 0.4) // Upper screen clouds
      size: number = 60 + Math.random() * 120
      alpha: number = 0.05 + Math.random() * 0.08
      speedX: number = 0.05 + Math.random() * 0.1

      reset() {
        this.x = -this.size
        this.y = Math.random() * (height * 0.4)
        this.size = 60 + Math.random() * 120
        this.alpha = 0.05 + Math.random() * 0.08
        this.speedX = 0.05 + Math.random() * 0.1
      }

      update() {
        this.x += this.speedX
        if (this.x > width + this.size) {
          this.reset()
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.beginPath()
        const gradient = c.createRadialGradient(
          this.x, this.y, 0,
          this.x, this.y, this.size
        )
        gradient.addColorStop(0, `rgba(148, 163, 184, ${this.alpha})`)
        gradient.addColorStop(0.8, `rgba(148, 163, 184, ${this.alpha * 0.2})`)
        gradient.addColorStop(1, 'rgba(148, 163, 184, 0)')
        c.fillStyle = gradient
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        c.fill()
      }
    }

    class StormyParticle {
      x: number = Math.random() * width
      y: number = Math.random() * height - height
      length: number = 10 + Math.random() * 20
      speedY: number = 12 + Math.random() * 8
      speedX: number = -1.5 - Math.random() * 1

      reset() {
        this.x = Math.random() * (width + 200)
        this.y = -30
        this.length = 10 + Math.random() * 20
        this.speedY = 12 + Math.random() * 8
        this.speedX = -1.5 - Math.random() * 1
      }

      update() {
        this.x += this.speedX
        this.y += this.speedY
        if (this.y > height) {
          this.reset()
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.beginPath()
        c.moveTo(this.x, this.y)
        c.lineTo(this.x + this.speedX * 1.5, this.y + this.length)
        c.strokeStyle = 'rgba(14, 165, 233, 0.4)'
        c.lineWidth = 1.2
        c.stroke()
      }
    }

    const sunnyCount = 45
    const cloudyCount = 15
    const stormyCount = 90

    const sunnyParticles: SunnyParticle[] = Array.from({ length: sunnyCount }, () => new SunnyParticle())
    const cloudyParticles: CloudyParticle[] = Array.from({ length: cloudyCount }, () => new CloudyParticle())
    const stormyParticles: StormyParticle[] = Array.from({ length: stormyCount }, () => new StormyParticle())

    let lightningFlash = 0
    let nextLightning = 200 + Math.random() * 300

    const tick = () => {
      if (!runAnimation) return

      frameCount++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastTime))
        frameCount = 0
        lastTime = now

        if (fps < 45) {
          fpsCounter++
          if (fpsCounter >= 3) {
            runAnimation = false
            ctx.clearRect(0, 0, width, height)
            console.warn('Weather animations disabled due to low frame-rate:', fps, 'FPS')
            return
          }
        } else {
          fpsCounter = 0
        }
      }

      ctx.clearRect(0, 0, width, height)

      if (weather === 'sunny') {
        sunnyParticles.forEach((p) => {
          p.update()
          p.draw(ctx)
        })
      } else if (weather === 'cloudy') {
        cloudyParticles.forEach((p) => {
          p.update()
          p.draw(ctx)
        })
      } else if (weather === 'stormy') {
        stormyParticles.forEach((p) => {
          p.update()
          p.draw(ctx)
        })

        nextLightning--
        if (nextLightning <= 0) {
          lightningFlash = 5 + Math.random() * 10
          nextLightning = 300 + Math.random() * 500
        }

        if (lightningFlash > 0) {
          lightningFlash--
          if (Math.random() > 0.3) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.12})`
            ctx.fillRect(0, 0, width, height)
          }
        }
      }

      animationId = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationId)
    }
  }, [weather])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}
