'use client'

export function triggerConfetti(x?: number, y?: number) {
  if (typeof window === 'undefined') return

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  ctx.scale(dpr, dpr)

  const particles: Array<{
    x: number
    y: number
    size: number
    color: string
    speedX: number
    speedY: number
    rotation: number
    rotationSpeed: number
  }> = []

  const colors = [
    '#f43f5e', '#ec4899', '#d946ef', '#a855f7',
    '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9',
    '#06b6d4', '#14b8a6', '#10b981', '#22c55e',
    '#84cc16', '#eab308', '#f97316'
  ]

  const count = x !== undefined && y !== undefined ? 60 : 150
  const startX = x !== undefined ? x : window.innerWidth / 2
  const startY = y !== undefined ? y : window.innerHeight

  for (let i = 0; i < count; i++) {
    particles.push({
      x: startX,
      y: startY,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedX: (Math.random() - 0.5) * (x !== undefined ? 12 : 8),
      speedY: x !== undefined ? (Math.random() - 0.7) * 12 : -10 - Math.random() * 15,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
    })
  }

  let animationFrameId: number
  const gravity = 0.45
  const startTime = Date.now()

  function animate() {
    if (!ctx) return
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    let active = false
    particles.forEach((p) => {
      p.x += p.speedX
      p.y += p.speedY
      p.speedY += gravity
      p.rotation += p.rotationSpeed

      if (p.y < window.innerHeight + 20) {
        active = true
      }

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      ctx.restore()
    })

    if (active && Date.now() - startTime < 2500) {
      animationFrameId = requestAnimationFrame(animate)
    } else {
      cancelAnimationFrame(animationFrameId)
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas)
      }
    }
  }

  animate()
}
