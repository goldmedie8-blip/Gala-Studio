// Generates the PNG app icons from public/icons/gala.svg.  Run: npm run icons
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const svg = readFileSync('public/icons/gala.svg')
const out = 'public/icons'

async function plain(size, name) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(`${out}/${name}`)
}

// Maskable icons need a safe zone: Android may crop up to 20% from every edge.
async function maskable(size, name) {
  const inner = Math.round(size * 0.62)
  const logo = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: '#f5a623' },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`${out}/${name}`)
}

await plain(192, 'icon-192.png')
await plain(512, 'icon-512.png')
await plain(180, 'apple-touch-icon.png')
await maskable(512, 'maskable-512.png')
console.log('Icons written to', out)
