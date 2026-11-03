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
  canvas.width = 640
  canvas.height = 900
  const context = canvas.getContext('2d')
  if (!context) return undefined

  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, 640, 900)
  const gradient = context.createLinearGradient(0, 0, 640, 580)
  gradient.addColorStop(0, '#071548')
  gradient.addColorStop(1, '#325cba')
  context.fillStyle = gradient
  context.fillRect(0, 0, 640, 540)

  context.strokeStyle = '#ffffff18'
  context.lineWidth = 2
  for (let radius = 120; radius <= 440; radius += 60) {
    context.beginPath()
    context.arc(580, 80, radius, 0, Math.PI * 2)
    context.stroke()
  }

  context.fillStyle = '#dbeafe'
  context.font = '600 24px sans-serif'
  context.fillText('AI GATEWAY', 52, 138)
  context.fillStyle = '#ffffff'
  context.beginPath()
  context.roundRect(52, 168, 220, 220, 36)
  context.fill()
  context.fillStyle = '#173269'
  context.font = '600 76px sans-serif'
  context.textAlign = 'center'
  context.fillText(details.initials, 162, 305, 184)
  context.textAlign = 'left'

  // Fit multilingual names without stretching or leaking past the card edge.
  const lines = [
    { text: details.name, y: 426, size: 42, color: '#ffffff', weight: 600 },
    {
      text: `@${details.username}`,
      y: 476,
      size: 26,
      color: '#dbeafe',
      weight: 400,
    },
    { text: details.role, y: 628, size: 32, color: '#071548', weight: 600 },
    { text: details.userId, y: 684, size: 25, color: '#475569', weight: 400 },
  ]
  for (const line of lines) {
    context.font = `${line.weight} ${line.size}px sans-serif`
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
  context.fillRect(52, 746, 536, 1)
  context.fillStyle = '#325cba'
  context.beginPath()
  context.roundRect(52, 798, 62, 8, 4)
  context.fill()
  context.fillStyle = '#64748b'
  context.font = '500 20px sans-serif'
  context.fillText('AI GATEWAY', 398, 810)
  return canvas.toDataURL('image/png')
}
