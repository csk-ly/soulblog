/*
 * starfield.js  v6.0.0
 *
 * Four-layer architecture with state machine:
 *   Layer 0 — Static stars: twinkling fixed stars on dark background (背景星点)
 *   Layer 1 — Slow starfield: slow radial outward stars (穿越星空, always on)
 *   Layer 2 — Galaxy: 3D tilted spiral galaxy at mouse, appears after 1000ms idle (银河系)
 *   Layer 3 — Comet: glowing comet trail follows cursor while moving (彗星)
 *
 * State machine:
 *   mouse moving        → comet mode (galaxy fades out, comet fades in)
 *   mouse idle > 1000ms → galaxy mode (comet fades out, galaxy fades in)
 *
 * Performance: zero per-frame color conversion, no Perlin noise, pooled comet particles.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory)
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.Starfield = factory()
  }
}(this, function () {
  const Starfield = {}

  const config = {
    // ─── Layer 0: Static background stars (twinkling) ───
    bgStaticStars: 300,
    bgTwinkleSpeed: 0.0015,

    // ─── Layer 1: Slow background starfield ───
    warpStars: 260,
    warpMaxRadius: 1400,
    warpBaseSpeed: 0.12,
    warpSpeedJitter: 0.06,
    warpSizeBase: 1.3,

    // ─── Layer 2: Galaxy (3D) ───
    galaxyStars: 4000,
    armCount: 2,
    armPitch: 0.55,
    coreRadius: 40,
    armInnerRadius: 80,
    armOuterRadius: 500,
    rotationSpeed: 0.0002,
    galaxyTilt: 1.42,
    galaxyTiltWobble: 0.45,
    galaxyTiltWobbleSpeed: 0.0008,
    coreGlowEnabled: true,
    coreGlowRadius: 100,

    // ─── Layer 3: Comet ───
    cometMaxParticles: 100,
    cometSpawnRate: 3,
    cometParticleLife: 800,
    cometHeadRadius: 30,

    // ─── State machine ───
    idleThreshold: 3000,
    fadeSpeed: 0.05,

    // ─── Colors ───
    starColor: 'rgb(180, 210, 255)',
    canvasColor: 'rgb(2, 2, 8)',
  }

  // ─── State ───
  let bgStaticList = []
  let warpStarList = []
  let galaxyStarList = []
  let cometParticles = []
  let cometPoolIdx = 0
  let centerX = 0
  let centerY = 0
  let originX = 0
  let originY = 0
  let mouseVelX = 0
  let mouseVelY = 0
  let lastMouseMoveTime = 0
  let galaxyAlpha = 0
  let galaxyScale = 1.0
  let cometAlpha = 0
  let isMoving = false
  let prevIsIdle = false
  let canvas
  let ctx
  let width
  let height
  let lastTimestamp = 0
  let canvasRGB = [2, 2, 8]
  let currentTilt = 1.15

  // Pre-computed palettes
  let bgPalette = []
  let corePalette = []
  let armPalette = []
  let hiiPalette = []
  let brightPalette = []
  let cometPalette = []

  // ─── Color helpers (init only) ───
  function rgbToHsl (r, g, b) {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h
    let s
    const l = (max + min) / 2
    if (max === min) { h = s = 0 } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break
        case g: h = ((b - r) / d + 2); break
        default: h = ((r - g) / d + 4); break
      }
      h /= 6
    }
    return [h * 360, s, l]
  }
  function hslToRgb (h, s, l) {
    let r, g, b
    h = h / 360
    if (s === 0) { r = g = b = l } else {
      const hue2rgb = function (p, q, t) {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1 / 6) return p + (q - p) * 6 * t
        if (t < 1 / 2) return q
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
        return p
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1 / 3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1 / 3)
    }
    return [r * 255, g * 255, b * 255]
  }
  function parseRGBA (color) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    return match ? [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)] : [255, 255, 255]
  }
  function roundRGB (rgb) {
    return [Math.round(rgb[0]), Math.round(rgb[1]), Math.round(rgb[2])]
  }

  function buildPalettes () {
    const baseRgb = parseRGBA(config.starColor)
    const baseHsl = rgbToHsl(baseRgb[0], baseRgb[1], baseRgb[2])

    // Background: cool whites & pale blues
    bgPalette = []
    for (let i = 0; i < 16; i++) {
      const t = i / 15
      const l = 0.72 + t * 0.26
      const h = (baseHsl[0] + (t - 0.5) * 25 + 360) % 360
      bgPalette.push(roundRGB(hslToRgb(h, baseHsl[1] * 0.4, l)))
    }

    // Galaxy core: warm gold → white-gold (真实星系核心)
    corePalette = []
    for (let i = 0; i < 12; i++) {
      const t = i / 11
      const h = 45 - t * 8
      const s = 0.40 - t * 0.15
      const l = 0.78 + t * 0.18
      corePalette.push(roundRGB(hslToRgb(h, Math.max(s, 0.15), Math.min(l, 0.96))))
    }

    // Galaxy arms: radial color gradient (星云深邃蓝紫)
    // Inner → outer: warm gold → blue-white → deep nebula blue-purple
    armPalette = []
    for (let i = 0; i < 48; i++) {
      const t = i / 47
      let h, s, l
      if (t < 0.15) {
        // Inner: warm gold (核心边缘)
        h = 45 - t * 80
        s = 0.50 - t * 0.4
        l = 0.82
      } else if (t < 0.30) {
        // Inner-mid: blue-white transition
        h = 200 + (t - 0.15) * 100
        s = 0.10 + (t - 0.15) * 1.5
        l = 0.85 - (t - 0.15) * 0.5
      } else if (t < 0.55) {
        // Mid: blue (星云蓝)
        h = 215 + (t - 0.30) * 30
        s = 0.55 + (t - 0.30) * 1.0
        l = 0.72 - (t - 0.30) * 0.30
      } else if (t < 0.80) {
        // Outer-mid: deep nebula blue (深邃星云蓝)
        h = 225 + (t - 0.55) * 30
        s = 0.85 + (t - 0.55) * 0.10
        l = 0.55 - (t - 0.55) * 0.30
      } else {
        // Outer: deep blue-violet (深邃紫蓝)
        h = 250 + (t - 0.80) * 20
        s = 0.80
        l = 0.40 - (t - 0.80) * 0.15
      }
      armPalette.push(roundRGB(hslToRgb(h, Math.min(s, 0.95), Math.max(Math.min(l, 0.92), 0.25))))
    }

    // HII regions: deep magenta star-forming nebulae (深邃紫红, 不抢戏)
    hiiPalette = []
    for (let i = 0; i < 10; i++) {
      const t = i / 9
      const h = 320 + t * 15
      const s = 0.70
      const l = 0.55 - t * 0.10
      hiiPalette.push(roundRGB(hslToRgb(h, s, l)))
    }

    // Bright stars: blue-white + warm gold (深邃星云中点缀)
    brightPalette = []
    for (let i = 0; i < 10; i++) {
      const t = i / 9
      let h, s, l
      if (i < 6) {
        // Blue-white giants
        h = 205 - t * 10
        s = 0.30 + t * 0.15
        l = 0.85 + t * 0.05
      } else {
        // Warm gold giants (蓝紫色星云中的暖色亮星)
        h = 40 + (t - 0.5) * 20
        s = 0.55 + (t - 0.5) * 0.20
        l = 0.75 + (t - 0.5) * 0.08
      }
      brightPalette.push(roundRGB(hslToRgb(h, s, Math.min(l, 0.92))))
    }

    // Comet: warm white → amber (distinguishes from cool galaxy)
    cometPalette = []
    for (let i = 0; i < 16; i++) {
      const t = i / 15
      const h = 48 - t * 18
      const s = 0.35 + t * 0.3
      const l = 0.8 - t * 0.15
      cometPalette.push(roundRGB(hslToRgb(h, s, l)))
    }
  }

  // ─── Layer 0: Static background star (twinkling, fixed position) ───
  function BgStar () { this.reset() }
  BgStar.prototype.reset = function () {
    this.x = Math.random() * width
    this.y = Math.random() * height
    this.sizeBase = 0.7 + Math.random() * 1.2
    this.twinklePhase = Math.random() * Math.PI * 2
    this.twinkleSpeed = 0.5 + Math.random() * 2.0
    this.colorIdx = Math.floor(Math.random() * bgPalette.length)
    this.baseBrightness = 0.30 + Math.random() * 0.55
  }
  BgStar.prototype.draw = function (time) {
    var twinkle = 0.5 + 0.5 * Math.sin(time * config.bgTwinkleSpeed * this.twinkleSpeed + this.twinklePhase)
    var alpha = this.baseBrightness * twinkle
    if (alpha <= 0.02) return
    var c = bgPalette[this.colorIdx]
    ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')'
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.sizeBase, 0, Math.PI * 2)
    ctx.fill()
  }

  // ─── Layer 1: Warp Star (slow radial outward from screen center) ───
  function WarpStar () { this.reset(true) }
  WarpStar.prototype.reset = function (initial) {
    this.angle = Math.random() * Math.PI * 2
    this.distance = initial ? Math.random() * config.warpMaxRadius : 0
    this.speed = config.warpBaseSpeed + Math.random() * config.warpSpeedJitter
    this.sizeBase = config.warpSizeBase * (0.5 + Math.random() * 1.2)
    this.colorIdx = Math.floor(Math.random() * bgPalette.length)
    this.x = centerX + Math.cos(this.angle) * this.distance
    this.y = centerY + Math.sin(this.angle) * this.distance
    this.px = this.x
    this.py = this.y
  }
  WarpStar.prototype.update = function (dt) {
    this.px = this.x
    this.py = this.y
    this.distance += this.speed * dt
    if (this.distance > config.warpMaxRadius) {
      this.distance = 0
      this.angle = Math.random() * Math.PI * 2
      this.x = centerX
      this.y = centerY
      this.px = this.x
      this.py = this.y
      return
    }
    this.x = centerX + Math.cos(this.angle) * this.distance
    this.y = centerY + Math.sin(this.angle) * this.distance
  }
  WarpStar.prototype.draw = function () {
    var fadeIn = Math.min(this.distance / 80, 1)
    var fadeOut = Math.max(0, 1 - (this.distance - config.warpMaxRadius * 0.78) / (config.warpMaxRadius * 0.22))
    var alpha = fadeIn * fadeOut * 0.85
    if (alpha <= 0.01) return
    var lw = this.sizeBase * (0.6 + this.distance / config.warpMaxRadius * 0.8)
    var c = bgPalette[this.colorIdx]
    ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')'
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(this.px, this.py)
    ctx.lineTo(this.x, this.y)
    ctx.stroke()
  }

  // ─── Layer 2: Galaxy Star (3D tilted spiral arms around mouse) ───
  function GalaxyStar () { this.reset(true) }
  GalaxyStar.prototype.reset = function (initial) {
    this.inCore = Math.random() < 0.22
    this.isHII = false
    this.isBright = false
    if (this.inCore) {
      this.radius = Math.random() * config.coreRadius
      this.armIndex = 0
      // Core: roughly spherical bulge — scatter in all directions (3D 球形核心)
      this.z = (Math.random() - 0.5) * config.coreRadius * 2.0
    } else {
      var t = Math.random()
      // Bias toward inner (denser like real galaxies)
      this.radius = config.armInnerRadius + t * t * (config.armOuterRadius - config.armInnerRadius)
      this.armIndex = Math.floor(Math.random() * config.armCount)
      // HII regions: ~3% of arm particles (深邃紫红, 适度)
      if (Math.random() < 0.03) {
        this.isHII = true
      } else if (Math.random() < 0.04) {
        // Bright stars: ~4% (蓝白巨星 + 暖色巨星)
        this.isBright = true
      }
      // Arm: thin disk — small vertical scatter (3D 厚度)
      this.z = (Math.random() - 0.5) * 70
    }
    var armBase = this.armIndex * (Math.PI * 2 / config.armCount)
    var spiralOffset = (1 / config.armPitch) * Math.log(this.radius / config.coreRadius)
    // Tighter arms (清晰的旋臂, 不弥散)
    var spread = this.inCore ? 0.4 : (2.0 + (this.radius / config.armOuterRadius) * 1.0)
    this.phase = armBase + spiralOffset + (Math.random() - 0.5) * spread
    this.sizeBase = (this.inCore ? 0.9 : 0.7) + Math.random() * 1.2
    if (this.isHII) this.sizeBase *= 1.8
    if (this.isBright) this.sizeBase *= 2.0

    // Color assignment
    if (this.inCore) {
      this.colorIdx = Math.floor(Math.random() * corePalette.length)
    } else if (this.isHII) {
      this.colorIdx = Math.floor(Math.random() * hiiPalette.length)
    } else if (this.isBright) {
      this.colorIdx = Math.floor(Math.random() * brightPalette.length)
    } else {
      // Color by normalized radius (radial temperature gradient)
      var normR = (this.radius - config.armInnerRadius) / (config.armOuterRadius - config.armInnerRadius)
      normR = Math.max(0, Math.min(1, normR))
      this.colorIdx = Math.floor(normR * (armPalette.length - 1))
    }
    this.depthFactor = 1
    this.x = originX + Math.cos(this.phase) * this.radius
    this.y = originY + Math.sin(this.phase) * this.radius
    this.px = this.x
    this.py = this.y
  }
  GalaxyStar.prototype.update = function (time) {
    var angle = this.phase + time * config.rotationSpeed
    // 3D position: galactic plane (x, z), vertical (y)
    var x3d = Math.cos(angle) * this.radius
    var z3d = Math.sin(angle) * this.radius
    var y3d = this.z
    // Tilt around X axis (viewing angle)
    var cosT = Math.cos(currentTilt)
    var sinT = Math.sin(currentTilt)
    var projY = y3d * cosT - z3d * sinT
    var depth = y3d * sinT + z3d * cosT
    this.px = this.x
    this.py = this.y
    this.x = originX + x3d * galaxyScale
    this.y = originY + projY * galaxyScale
    // Depth factor: near side brighter, far side dimmer (增强 3D 深度对比)
    var normDepth = depth / config.armOuterRadius
    this.depthFactor = Math.max(0.05, Math.min(1.0, 0.55 - normDepth * 0.5))
  }
  GalaxyStar.prototype.draw = function (alphaMul) {
    var baseAlpha = this.inCore ? 1.0 : 0.88
    if (this.isHII) baseAlpha = 0.75
    if (this.isBright) baseAlpha = 1.0
    var alpha = baseAlpha * alphaMul * (this.depthFactor || 1)
    if (alpha <= 0.01) return
    var coreFactor = Math.max(0, 1 - this.radius / config.armOuterRadius)
    var r = Math.min(this.sizeBase * (0.6 + coreFactor * 0.7), 3.5)
    var c
    if (this.inCore) {
      c = corePalette[this.colorIdx]
    } else if (this.isHII) {
      c = hiiPalette[this.colorIdx]
    } else if (this.isBright) {
      c = brightPalette[this.colorIdx]
    } else {
      c = armPalette[this.colorIdx]
    }
    var rgbStr = c[0] + ',' + c[1] + ',' + c[2]

    // HII: small, tight nebula glow (深邃紫红星云, 不抢戏)
    if (this.isHII) {
      ctx.fillStyle = 'rgba(' + rgbStr + ',' + (alpha * 0.06) + ')'
      ctx.beginPath()
      ctx.arc(this.x, this.y, r * 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(' + rgbStr + ',' + (alpha * 0.15) + ')'
      ctx.beginPath()
      ctx.arc(this.x, this.y, r * 1.8, 0, Math.PI * 2)
      ctx.fill()
    }

    // Bright stars: very subtle cross-shaped glow (亮星十字光芒, 微弱)
    if (this.isBright) {
      ctx.fillStyle = 'rgba(' + rgbStr + ',' + (alpha * 0.05) + ')'
      ctx.beginPath()
      ctx.arc(this.x, this.y, r * 3, 0, Math.PI * 2)
      ctx.fill()
      // Diffraction spikes (十字光芒, 短而细)
      ctx.strokeStyle = 'rgba(' + rgbStr + ',' + (alpha * 0.18) + ')'
      ctx.lineWidth = 0.5
      var spikeLen = r * 2.5
      ctx.beginPath()
      ctx.moveTo(this.x - spikeLen, this.y)
      ctx.lineTo(this.x + spikeLen, this.y)
      ctx.moveTo(this.x, this.y - spikeLen)
      ctx.lineTo(this.x, this.y + spikeLen)
      ctx.stroke()
    }

    // Soft glow (reduced radius)
    ctx.fillStyle = 'rgba(' + rgbStr + ',' + (alpha * 0.15) + ')'
    ctx.beginPath()
    ctx.arc(this.x, this.y, r * 2.5, 0, Math.PI * 2)
    ctx.fill()
    // Medium glow
    ctx.fillStyle = 'rgba(' + rgbStr + ',' + (alpha * 0.35) + ')'
    ctx.beginPath()
    ctx.arc(this.x, this.y, r * 1.4, 0, Math.PI * 2)
    ctx.fill()
    // Bright core dot
    ctx.fillStyle = 'rgba(' + rgbStr + ',' + alpha + ')'
    ctx.beginPath()
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // ─── Layer 3: Comet Particle (pooled) ───
  function CometParticle () {
    this.active = false
    this.x = 0
    this.y = 0
    this.px = 0
    this.py = 0
    this.vx = 0
    this.vy = 0
    this.life = 0
    this.size = 1
    this.colorIdx = 0
  }
  CometParticle.prototype.spawn = function (x, y, vx, vy) {
    this.active = true
    this.x = x
    this.y = y
    this.px = x
    this.py = y
    var speed = Math.sqrt(vx * vx + vy * vy)
    // Fly backward relative to mouse movement direction
    var dirX = speed > 0 ? vx / speed : 0
    var dirY = speed > 0 ? vy / speed : 0
    var spread = 0.4
    this.vx = -dirX * (0.5 + Math.random() * 1.5) + (Math.random() - 0.5) * spread
    this.vy = -dirY * (0.5 + Math.random() * 1.5) + (Math.random() - 0.5) * spread
    this.life = 1.0
    this.size = 0.5 + Math.random() * 1.0
    this.colorIdx = Math.floor(Math.random() * cometPalette.length)
  }
  CometParticle.prototype.update = function (dt) {
    if (!this.active) return
    this.px = this.x
    this.py = this.y
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.vx *= 0.97
    this.vy *= 0.97
    this.life -= (dt * 16.67) / config.cometParticleLife
    if (this.life <= 0) this.active = false
  }
  CometParticle.prototype.draw = function () {
    if (!this.active) return
    var alpha = this.life * cometAlpha
    if (alpha <= 0.01) return
    var c = cometPalette[this.colorIdx]
    // Glow
    ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (alpha * 0.2) + ')'
    ctx.lineWidth = this.size * 4
    ctx.beginPath()
    ctx.moveTo(this.px, this.py)
    ctx.lineTo(this.x, this.y)
    ctx.stroke()
    // Core
    ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')'
    ctx.lineWidth = this.size * 1.5
    ctx.beginPath()
    ctx.moveTo(this.px, this.py)
    ctx.lineTo(this.x, this.y)
    ctx.stroke()
  }

  function spawnComet (x, y, vx, vy) {
    var p = cometParticles[cometPoolIdx]
    p.spawn(x, y, vx, vy)
    cometPoolIdx = (cometPoolIdx + 1) % cometParticles.length
  }

  function drawCometHead () {
    if (cometAlpha < 0.01) return
    var r = config.cometHeadRadius
    var grad = ctx.createRadialGradient(originX, originY, 0, originX, originY, r)
    grad.addColorStop(0, 'rgba(255, 250, 230, ' + (0.55 * cometAlpha) + ')')
    grad.addColorStop(0.2, 'rgba(255, 220, 150, ' + (0.28 * cometAlpha) + ')')
    grad.addColorStop(0.5, 'rgba(255, 180, 80, ' + (0.1 * cometAlpha) + ')')
    grad.addColorStop(1, 'rgba(255, 150, 50, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(originX, originY, r, 0, Math.PI * 2)
    ctx.fill()
    // Bright nucleus
    ctx.fillStyle = 'rgba(255, 255, 245, ' + (0.85 * cometAlpha) + ')'
    ctx.beginPath()
    ctx.arc(originX, originY, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // ─── 3D projection helper (shared by update + repositionGalaxy) ───
  function projectGalaxy3D (star, time) {
    var angle = star.phase + time * config.rotationSpeed
    var x3d = Math.cos(angle) * star.radius
    var z3d = Math.sin(angle) * star.radius
    var y3d = star.z
    var cosT = Math.cos(currentTilt)
    var sinT = Math.sin(currentTilt)
    var projY = y3d * cosT - z3d * sinT
    var depth = y3d * sinT + z3d * cosT
    star.x = originX + x3d * galaxyScale
    star.y = originY + projY * galaxyScale
    var normDepth = depth / config.armOuterRadius
    star.depthFactor = Math.max(0.05, Math.min(1.0, 0.55 - normDepth * 0.5))
  }

  // ─── Setup ───
  function setup (userConfig) {
    Object.assign(config, userConfig || {})
    var container = config.container || document.querySelector('.starfield')
    if (!container) throw new Error('Starfield: No container element found.')
    container.style.position = 'relative'

    width = container.clientWidth
    height = container.clientHeight
    centerX = width / 2
    centerY = height / 2
    originX = config.originX != null ? config.originX : centerX
    originY = config.originY != null ? config.originY : centerY
    currentTilt = config.galaxyTilt

    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.zIndex = '-1'
    canvasRGB = parseRGBA(config.canvasColor)
    container.appendChild(canvas)
    ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'

    buildPalettes()

    bgStaticList = []
    for (var s0 = 0; s0 < config.bgStaticStars; s0++) bgStaticList.push(new BgStar())

    warpStarList = []
    for (var i = 0; i < config.warpStars; i++) warpStarList.push(new WarpStar())

    galaxyStarList = []
    for (var j = 0; j < config.galaxyStars; j++) galaxyStarList.push(new GalaxyStar())

    cometParticles = []
    for (var k = 0; k < config.cometMaxParticles; k++) cometParticles.push(new CometParticle())

    lastMouseMoveTime = 0

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') lastTimestamp = 0
    })

    requestAnimationFrame(draw)
  }

  // ─── Main loop ───
  function draw (timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp
    var dt = Math.min((timestamp - lastTimestamp) / 16.67, 3)
    lastTimestamp = timestamp

    // ─── State machine ───
    var hasMoved = lastMouseMoveTime > 0
    var isIdle = !hasMoved || (timestamp - lastMouseMoveTime) > config.idleThreshold

    // Detect transitions for converge/disperse:
    //   idle starts  → galaxy converges inward (scale 2.5 → 1.0, over 1s)
    //   moving starts → galaxy disperses outward (scale 1.0 → 3.0, over 2s)
    if (isIdle && !prevIsIdle) {
      galaxyScale = 2.5 // start wide, will converge inward
    }
    prevIsIdle = isIdle

    // Galaxy alpha: fade in ~1s (0.05), fade out ~2s (0.025)
    var galaxyTarget = isIdle ? 1 : 0
    var cometTarget = isIdle ? 0 : 1
    var galaxyFadeRate = isIdle ? 0.05 : 0.025
    galaxyAlpha += (galaxyTarget - galaxyAlpha) * galaxyFadeRate * dt
    // Galaxy scale: converge to 1.0 when idle, disperse to 3.0 when moving
    var galaxyScaleTarget = isIdle ? 1.0 : 3.0
    galaxyScale += (galaxyScaleTarget - galaxyScale) * galaxyFadeRate * dt
    cometAlpha += (cometTarget - cometAlpha) * 0.05 * dt
    galaxyAlpha = Math.max(0, Math.min(1, galaxyAlpha))
    cometAlpha = Math.max(0, Math.min(1, cometAlpha))

    // ─── Trail fade ───
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(' + canvasRGB[0] + ',' + canvasRGB[1] + ',' + canvasRGB[2] + ',0.55)'
    ctx.fillRect(0, 0, width, height)

    // ─── Layer 0: Static background stars (twinkling) ───
    ctx.globalCompositeOperation = 'lighter'
    for (var s0 = 0; s0 < bgStaticList.length; s0++) {
      bgStaticList[s0].draw(timestamp)
    }

    // ─── Layer 1: Background warp (always on, lighter for glow) ───
    ctx.globalCompositeOperation = 'lighter'
    for (var b = 0; b < warpStarList.length; b++) {
      warpStarList[b].update(dt)
      warpStarList[b].draw()
    }

    // ─── Layer 2: Galaxy (3D) ───
    // Compute current tilt (slowly wobbling for 3D feel)
    currentTilt = config.galaxyTilt + Math.sin(timestamp * config.galaxyTiltWobbleSpeed) * config.galaxyTiltWobble
    // Always update positions (continuous rotation), only draw when visible
    for (var i = 0; i < galaxyStarList.length; i++) {
      galaxyStarList[i].update(timestamp)
    }
    if (galaxyAlpha > 0.01) {
      // Erase galaxy region with opaque background to clear warp trails beneath it
      ctx.globalCompositeOperation = 'source-over'
      var galaxyR = config.armOuterRadius + config.coreGlowRadius * 0.5
      ctx.fillStyle = 'rgb(' + canvasRGB[0] + ',' + canvasRGB[1] + ',' + canvasRGB[2] + ')'
      ctx.fillRect(originX - galaxyR, originY - galaxyR, galaxyR * 2, galaxyR * 2)

      ctx.globalCompositeOperation = 'lighter'
      if (config.coreGlowEnabled) {
        var r = config.coreGlowRadius
        var bulgeScale = Math.cos(currentTilt) * 0.5 + 0.5
        ctx.save()
        ctx.translate(originX, originY)
        ctx.scale(1, bulgeScale)
        // Inner bulge: warm gold-white core (真实星系核心, 收紧)
        var grad1 = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5)
        grad1.addColorStop(0, 'rgba(255, 248, 220, ' + (0.50 * galaxyAlpha) + ')')
        grad1.addColorStop(0.3, 'rgba(255, 230, 180, ' + (0.28 * galaxyAlpha) + ')')
        grad1.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = grad1
        ctx.beginPath()
        ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2)
        ctx.fill()
        // Outer halo: faint warm gold, very soft
        var grad2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
        grad2.addColorStop(0, 'rgba(255, 235, 190, ' + (0.20 * galaxyAlpha) + ')')
        grad2.addColorStop(0.3, 'rgba(230, 200, 150, ' + (0.10 * galaxyAlpha) + ')')
        grad2.addColorStop(0.7, 'rgba(180, 150, 110, ' + (0.04 * galaxyAlpha) + ')')
        grad2.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = grad2
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      for (var i2 = 0; i2 < galaxyStarList.length; i2++) {
        galaxyStarList[i2].draw(galaxyAlpha)
      }
    }

    // ─── Layer 3: Comet ───
    if (cometAlpha > 0.01) {
      ctx.globalCompositeOperation = 'lighter'
      // Spawn particles while mouse is actively moving
      if (isMoving && (mouseVelX * mouseVelX + mouseVelY * mouseVelY) > 1) {
        for (var s = 0; s < config.cometSpawnRate; s++) {
          spawnComet(originX, originY, mouseVelX, mouseVelY)
        }
      }
      // Update and draw all comet particles
      for (var c = 0; c < cometParticles.length; c++) {
        cometParticles[c].update(dt)
        cometParticles[c].draw()
      }
      // Comet head glow
      drawCometHead()
    }

    // Decay mouse velocity
    mouseVelX *= 0.85
    mouseVelY *= 0.85
    if (mouseVelX * mouseVelX + mouseVelY * mouseVelY < 1) {
      isMoving = false
    }

    ctx.globalCompositeOperation = 'source-over'
    requestAnimationFrame(draw)
  }

  // ─── Public API ───
  function repositionGalaxy () {
    // Recompute all galaxy star positions for current origin + sync prev pos
    // Prevents streak flashes when origin jumps while galaxy is still visible
    var time = lastTimestamp || performance.now()
    for (var i = 0; i < galaxyStarList.length; i++) {
      var s = galaxyStarList[i]
      projectGalaxy3D(s, time)
      s.px = s.x
      s.py = s.y
    }
  }
  function setOrigin (x, y) {
    // Track mouse velocity for comet direction
    mouseVelX = x - originX
    mouseVelY = y - originY
    originX = x
    originY = y
    lastMouseMoveTime = performance.now()
    isMoving = true
    // Recompute galaxy positions to new origin immediately
    repositionGalaxy()
  }
  function resize (w, h) {
    width = w
    height = h
    centerX = w / 2
    centerY = h / 2
    canvas.width = w
    canvas.height = h
    warpStarList.forEach(function (s) { s.reset(true) })
    bgStaticList.forEach(function (s) { s.reset() })
  }
  function cleanup () {
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas)
    bgStaticList = []
    warpStarList = []
    galaxyStarList = []
    cometParticles = []
    lastTimestamp = 0
  }

  Starfield.setup = setup
  Starfield.setOrigin = setOrigin
  Starfield.resize = resize
  Starfield.config = config
  Starfield.cleanup = cleanup

  return Starfield
}))
