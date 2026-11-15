interface ProfileCardDetails {
  name: string
  username: string
  initials: string
  role: string
  userId: string
}

// Generate the texture locally: profile data never leaves the browser.
export function createProfileCardTexture(
  details: ProfileCardDetails
): string | undefined {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1440
  const context = canvas.getContext('2d')
  if (!context) return undefined
  // Match the 3D face texture resolution while keeping logical card coordinates.
  context.scale(canvas.width / 640, canvas.height / 900)
  const fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif'

  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, 640, 900)
  const gradient = context.createLinearGradient(0, 0, 640, 580)
  gradient.addColorStop(0, '#071548')
  gradient.addColorStop(1, '#325cba')
  context.fillStyle = gradient
  context.fillRect(0, 0, 640, 560)

  context.strokeStyle = '#ffffff18'
  context.lineWidth = 2
  for (let radius = 120; radius <= 440; radius += 60) {
    context.beginPath()
    context.arc(580, 80, radius, 0, Math.PI * 2)
    context.stroke()
  }

  context.fillStyle = '#ffffff'
  context.beginPath()
  context.roundRect(52, 164, 208, 208, 32)
  context.fill()
  context.fillStyle = '#173269'
  context.font = `700 96px ${fontFamily}`
  context.textAlign = 'center'
  context.fillText(details.initials, 156, 304, 172)
  context.textAlign = 'left'

  // Fit multilingual names without stretching or leaking past the card edge.
  const lines = [
    { text: details.name, y: 470, size: 64, color: '#ffffff', weight: 700 },
    {
      text: `@${details.username}`,
      y: 528,
      size: 46,
      color: '#dbeafe',
      weight: 600,
    },
    { text: details.role, y: 648, size: 52, color: '#071548', weight: 700 },
    { text: details.userId, y: 718, size: 38, color: '#334155', weight: 600 },
  ]
  for (const line of lines) {
    context.font = `${line.weight} ${line.size}px ${fontFamily}`
    context.fillStyle = line.color
    const characters = [...line.text]
    let text = line.text
    while (characters.length && context.measureText(text).width > 536) {
      characters.pop()
      text = `${characters.join('')}…`
    }
    context.fillText(text, 52, line.y)
  }

  context.fillStyle = '#cbd5e1'
  context.fillRect(52, 762, 536, 1)
  context.fillStyle = '#325cba'
  context.beginPath()
  context.roundRect(52, 814, 62, 8, 4)
  context.fill()
  context.fillStyle = '#64748b'
  context.font = `600 28px ${fontFamily}`
  context.fillText('AI GATEWAY', 380, 830)
  return canvas.toDataURL('image/png')
}
