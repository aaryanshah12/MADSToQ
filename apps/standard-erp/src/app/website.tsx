'use client'

import { useState } from 'react'
import { Menu, X, Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from 'lucide-react'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Point = { cx: number; cy: number }
type Country = Point & { name: string }
type Product = { sr: number; name: string; fullname: string; mw: string; cas: string; purity: string }

// â”€â”€â”€ WORLD MAP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WorldMapSVG = () => {
  const hub: Point = { cx: 890, cy: 255 }

  const countries: Country[] = [
    { name: 'CANADA',     cx: 175,  cy: 175 },
    { name: 'USA',        cx: 140,  cy: 215 },
    { name: 'BRAZIL',     cx: 230,  cy: 325 },
    { name: 'POLAND',     cx: 435,  cy: 195 },
    { name: 'ITALY',      cx: 415,  cy: 220 },
    { name: 'TURKEY',     cx: 472,  cy: 205 },
    { name: 'EGYPT',      cx: 450,  cy: 240 },
    { name: 'BANGLADESH', cx: 930,  cy: 240 },
    { name: 'CHINA',      cx: 985,  cy: 185 },
    { name: 'TAIWAN',     cx: 1020, cy: 210 },
    { name: 'JAPAN',      cx: 1065, cy: 180 },
    { name: 'THAILAND',   cx: 955,  cy: 275 },
    { name: 'INDONESIA',  cx: 1020, cy: 305 },
    { name: 'AUSTRALIA',  cx: 1065, cy: 380 },
  ]

  const getCurvePath = (from: Point, to: Point): string => {
    const mx = (from.cx + to.cx) / 2
    const my = (from.cy + to.cy) / 2
    const dx = to.cx - from.cx
    const dy = to.cy - from.cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const arcY = my - dist * 0.18
    return `M ${from.cx} ${from.cy} Q ${mx} ${arcY} ${to.cx} ${to.cy}`
  }

  const dots: [number, number][] = []
  const step = 11

  // North America
  for (let x = 95; x <= 335; x += step) for (let y = 140; y <= 295; y += step) {
    if (x > 95 + (y - 140) * 0.12 && x < 335 - (y - 200) * 0.25 && !(x > 280 && y > 240)) dots.push([x, y])
  }
  // South America
  for (let x = 165; x <= 300; x += step) for (let y = 305; y <= 440; y += step) {
    if (x > 165 + (y - 305) * 0.06 && x < 300 - (y - 370) * 0.07) dots.push([x, y])
  }
  // Europe
  for (let x = 380; x <= 570; x += step) for (let y = 148; y <= 250; y += step) {
    if (x < 570 - (y - 200) * 0.3 && !(x > 530 && y < 165)) dots.push([x, y])
  }
  // Africa
  for (let x = 410; x <= 600; x += step) for (let y = 258; y <= 455; y += step) {
    if (x > 410 + (y - 380) * 0.1 && x < 600 - (y - 400) * 0.05) dots.push([x, y])
  }
  // Asia
  for (let x = 590; x <= 1145; x += step) for (let y = 140; y <= 320; y += step) {
    if (!(x > 620 && x < 680 && y > 270)) dots.push([x, y])
  }
  // SE Asia islands â€” FIXED: loop condition was swapped
  for (let x = 940; x <= 1100; x += step) for (let y = 328; y <= 400; y += step) {
    if (x < 1000 || (x > 1020 && x < 1070) || x > 1085) dots.push([x, y])
  }
  // Australia
  for (let x = 970; x <= 1140; x += step) for (let y = 365; y <= 460; y += step) {
    if (x < 1135 - (y - 430) * 0.3) dots.push([x, y])
  }

  const PinBlue = ({ cx, cy }: Point) => (
    <g transform={`translate(${cx - 7}, ${cy - 20})`}>
      <path d="M7 0 C3.1 0 0 3.1 0 7 C0 12.25 7 20 7 20 C7 20 14 12.25 14 7 C14 3.1 10.9 0 7 0Z" fill="#1E3A8A" />
      <circle cx="7" cy="7" r="3" fill="white" />
    </g>
  )

  return (
    <svg viewBox="0 0 1160 480" className="w-full" xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#eeeeee', borderRadius: '10px' }}>
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#bbbbbb" />
      ))}
      {countries.map((c, i) => (
        <path key={i} d={getCurvePath(hub, c)} fill="none" stroke="#888888" strokeWidth="1.2" opacity="0.75" />
      ))}
      {countries.map((c, i) => (
        <g key={i}>
          <PinBlue cx={c.cx} cy={c.cy} />
          <text x={c.cx} y={c.cy + 10} fontSize="9.5" fontWeight="700"
            textAnchor="middle" fill="#1E3A8A" fontFamily="Arial, sans-serif">
            {c.name}
          </text>
        </g>
      ))}
      <g transform={`translate(${hub.cx - 11}, ${hub.cy - 30})`}>
        <path d="M11 0 C4.9 0 0 4.9 0 11 C0 19.25 11 31 11 31 C11 31 22 19.25 22 11 C22 4.9 17.1 0 11 0Z" fill="#DC2626" />
        <circle cx="11" cy="11" r="4.5" fill="white" />
      </g>
      <text x={hub.cx + 14} y={hub.cy + 3} fontSize="12" fontWeight="900"
        fill="#DC2626" fontFamily="Arial, sans-serif" letterSpacing="0.5">INDIA</text>
    </svg>
  )
}

// â”€â”€â”€ CHEMICAL STRUCTURE SVGs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const structures: Record<number, () => JSX.Element> = {
  1: () => (
    <svg viewBox="0 0 120 120" width="90" height="90">
      <g transform="translate(60,60)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <line x1="0" y1="-28" x2="0" y2="-42" stroke="#333" strokeWidth="1.2"/>
        <text x="0" y="-48" textAnchor="middle" fontSize="9" fill="#333">OH</text>
        <line x1="24" y1="-14" x2="36" y2="-21" stroke="#333" strokeWidth="1.2"/>
        <text x="44" y="-18" textAnchor="middle" fontSize="9" fill="#1a6">NH&#8322;</text>
        <line x1="24" y1="14" x2="36" y2="21" stroke="#333" strokeWidth="1.2"/>
        <text x="44" y="24" textAnchor="middle" fontSize="8" fill="#333">SO&#8323;H</text>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
      </g>
    </svg>
  ),
  2: () => (
    <svg viewBox="0 0 140 130" width="100" height="90">
      <g transform="translate(65,65)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
        <text x="0" y="-38" textAnchor="middle" fontSize="8" fill="#1a6">NH&#8322;</text>
        <line x1="0" y1="-28" x2="0" y2="-33" stroke="#333" strokeWidth="1.2"/>
        <text x="28" y="-18" textAnchor="start" fontSize="8" fill="#333">OH</text>
        <line x1="24" y1="-14" x2="30" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="-46" y="0" textAnchor="end" fontSize="8" fill="#333">HO&#8323;S</text>
        <line x1="-24" y1="0" x2="-32" y2="0" stroke="#333" strokeWidth="1.2"/>
        <text x="30" y="24" textAnchor="start" fontSize="8" fill="#333">NHAc</text>
        <line x1="24" y1="14" x2="30" y2="20" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  3: () => (
    <svg viewBox="0 0 130 130" width="95" height="90">
      <g transform="translate(65,65)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
        <text x="-36" y="-18" textAnchor="end" fontSize="8" fill="#333">HO&#8323;S</text>
        <line x1="-24" y1="-14" x2="-32" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="30" y="-18" textAnchor="start" fontSize="8" fill="#1a6">NH&#8322;</text>
        <line x1="24" y1="-14" x2="30" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="-4" y="-36" textAnchor="middle" fontSize="8" fill="#333">OH</text>
        <line x1="0" y1="-28" x2="0" y2="-32" stroke="#333" strokeWidth="1.2"/>
        <text x="0" y="40" textAnchor="middle" fontSize="8" fill="#c00">NO&#8322;</text>
        <line x1="0" y1="28" x2="0" y2="33" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  4: () => (
    <svg viewBox="0 0 130 130" width="95" height="90">
      <g transform="translate(65,65)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
        <text x="-36" y="-18" textAnchor="end" fontSize="8" fill="#c00">O&#8322;N</text>
        <line x1="-24" y1="-14" x2="-32" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="30" y="-18" textAnchor="start" fontSize="8" fill="#1a6">NH&#8322;</text>
        <line x1="24" y1="-14" x2="30" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="-4" y="-36" textAnchor="middle" fontSize="8" fill="#333">OH</text>
        <line x1="0" y1="-28" x2="0" y2="-32" stroke="#333" strokeWidth="1.2"/>
        <text x="0" y="40" textAnchor="middle" fontSize="8" fill="#333">SO&#8323;H</text>
        <line x1="0" y1="28" x2="0" y2="33" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  5: () => (
    <svg viewBox="0 0 130 130" width="95" height="90">
      <g transform="translate(65,60)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
        <text x="0" y="-38" textAnchor="middle" fontSize="9" fill="#090">Cl</text>
        <line x1="0" y1="-28" x2="0" y2="-33" stroke="#333" strokeWidth="1.2"/>
        <text x="36" y="-18" textAnchor="start" fontSize="8" fill="#333">SO&#8323;H</text>
        <line x1="24" y1="-14" x2="32" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="0" y="40" textAnchor="middle" fontSize="8" fill="#c00">NO&#8322;</text>
        <line x1="0" y1="28" x2="0" y2="33" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  6: () => (
    <svg viewBox="0 0 200 100" width="140" height="80">
      <g transform="translate(10,50)">
        <polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(25,0)"/>
        <circle cx="25" cy="0" r="11" fill="none" stroke="#333" strokeWidth="0.8"/>
        <text x="25" y="-30" textAnchor="middle" fontSize="8" fill="#1a6">H&#8322;N</text>
        <line x1="25" y1="-22" x2="25" y2="-27" stroke="#333" strokeWidth="1.2"/>
        <line x1="44" y1="0" x2="58" y2="0" stroke="#333" strokeWidth="1.2"/>
        <text x="51" y="-6" textAnchor="middle" fontSize="8" fill="#333">NH</text>
        <polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(90,0)"/>
        <circle cx="90" cy="0" r="11" fill="none" stroke="#333" strokeWidth="0.8"/>
        <text x="90" y="-30" textAnchor="middle" fontSize="8" fill="#333">HO&#8323;S</text>
        <line x1="90" y1="-22" x2="90" y2="-27" stroke="#333" strokeWidth="1.2"/>
        <text x="115" y="4" textAnchor="start" fontSize="8" fill="#c00">NO&#8322;</text>
        <line x1="109" y1="0" x2="115" y2="0" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  7: () => (
    <svg viewBox="0 0 200 100" width="140" height="80">
      <g transform="translate(10,50)">
        <polygon points="0,-20 17,-10 17,10 0,20 -17,10 -17,-10" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(22,0)"/>
        <circle cx="22" cy="0" r="10" fill="none" stroke="#333" strokeWidth="0.8"/>
        <text x="22" y="-28" textAnchor="middle" fontSize="8" fill="#1a6">H&#8322;N</text>
        <line x1="22" y1="-20" x2="22" y2="-25" stroke="#333" strokeWidth="1.2"/>
        <line x1="39" y1="0" x2="52" y2="0" stroke="#333" strokeWidth="1.5"/>
        <text x="46" y="-6" textAnchor="middle" fontSize="8" fill="#333">N=N</text>
        <polygon points="0,-20 17,-10 17,10 0,20 -17,10 -17,-10" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(85,0)"/>
        <circle cx="85" cy="0" r="10" fill="none" stroke="#333" strokeWidth="0.8"/>
        <text x="107" y="4" textAnchor="start" fontSize="8" fill="#333">SO&#8323;H</text>
        <line x1="102" y1="0" x2="108" y2="0" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  8: () => (
    <svg viewBox="0 0 120 120" width="90" height="90">
      <g transform="translate(60,55)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
        <text x="0" y="-38" textAnchor="middle" fontSize="8" fill="#333">SO&#8323;H</text>
        <line x1="0" y1="-28" x2="0" y2="-33" stroke="#333" strokeWidth="1.2"/>
        <text x="0" y="40" textAnchor="middle" fontSize="8" fill="#1a6">NH&#8322;</text>
        <line x1="0" y1="28" x2="0" y2="33" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  9: () => (
    <svg viewBox="0 0 200 130" width="140" height="90">
      <g transform="translate(10,20)">
        <rect x="40" y="20" width="50" height="40" rx="4" fill="none" stroke="#333" strokeWidth="1.5"/>
        <rect x="90" y="20" width="50" height="40" rx="4" fill="none" stroke="#333" strokeWidth="1.5"/>
        <text x="60" y="45" textAnchor="middle" fontSize="7" fill="#333">N</text>
        <text x="100" y="45" textAnchor="middle" fontSize="7" fill="#333">N</text>
        <text x="130" y="45" textAnchor="middle" fontSize="7" fill="#c00">Cl</text>
        <text x="40" y="12" textAnchor="middle" fontSize="7" fill="#333">SO&#8323;H</text>
        <text x="140" y="12" textAnchor="middle" fontSize="7" fill="#333">SO&#8323;H</text>
        <text x="10" y="70" textAnchor="start" fontSize="7" fill="#1a6">NH-CH&#8322;CH&#8322;NH&#8322;</text>
        <text x="130" y="80" textAnchor="start" fontSize="7" fill="#1a6">NHCH&#8322;CH&#8322;NH&#8322;</text>
        <line x1="40" y1="60" x2="20" y2="72" stroke="#333" strokeWidth="1.2"/>
        <line x1="140" y1="60" x2="150" y2="72" stroke="#333" strokeWidth="1.2"/>
        <text x="75" y="95" textAnchor="middle" fontSize="7" fill="#c00">Cl</text>
        <line x1="65" y1="60" x2="65" y2="88" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  10: () => (
    <svg viewBox="0 0 200 130" width="140" height="90">
      <g transform="translate(15,20)">
        <rect x="55" y="25" width="55" height="45" fill="none" stroke="#333" strokeWidth="1.5"/>
        <polygon points="55,25 35,25 20,48 35,70 55,70" fill="none" stroke="#333" strokeWidth="1.5"/>
        <polygon points="110,25 130,25 145,48 130,70 110,70" fill="none" stroke="#333" strokeWidth="1.5"/>
        <text x="83" y="35" textAnchor="middle" fontSize="7" fill="#333">O</text>
        <text x="83" y="65" textAnchor="middle" fontSize="7" fill="#333">O</text>
        <text x="38" y="45" textAnchor="middle" fontSize="7" fill="#1a6">NH&#8322;</text>
        <text x="128" y="45" textAnchor="middle" fontSize="7" fill="#1a6">NH&#8322;</text>
        <text x="60" y="18" fontSize="7" fill="#333">SO&#8323;Na</text>
        <text x="100" y="18" fontSize="7" fill="#333">SO&#8323;Na</text>
        <text x="30" y="90" fontSize="7" fill="#333">CH&#8323; CH&#8323;</text>
        <text x="110" y="90" fontSize="7" fill="#333">CH&#8323;</text>
      </g>
    </svg>
  ),
  11: () => (
    <svg viewBox="0 0 130 130" width="95" height="90">
      <g transform="translate(65,60)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
        <text x="-36" y="-18" textAnchor="end" fontSize="8" fill="#1a6">NH&#8322;</text>
        <line x1="-24" y1="-14" x2="-32" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="30" y="-18" textAnchor="start" fontSize="8" fill="#090">Cl</text>
        <line x1="24" y1="-14" x2="30" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="-4" y="-36" textAnchor="middle" fontSize="8" fill="#090">Cl</text>
        <line x1="0" y1="-28" x2="0" y2="-32" stroke="#333" strokeWidth="1.2"/>
        <text x="0" y="40" textAnchor="middle" fontSize="8" fill="#333">SO&#8323;H</text>
        <line x1="0" y1="28" x2="0" y2="33" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  12: () => (
    <svg viewBox="0 0 200 120" width="140" height="90">
      <g transform="translate(20,55)">
        <polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(25,0)"/>
        <circle cx="25" cy="0" r="11" fill="none" stroke="#333" strokeWidth="0.8"/>
        <text x="25" y="-30" textAnchor="middle" fontSize="8" fill="#1a6">H&#8322;N</text>
        <line x1="25" y1="-22" x2="25" y2="-27" stroke="#333" strokeWidth="1.2"/>
        <polygon points="44,0 58,-14 78,-14 88,0 78,14 58,14" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(10,0)"/>
        <text x="75" y="4" textAnchor="middle" fontSize="8" fill="#333">N</text>
        <text x="65" y="-12" textAnchor="middle" fontSize="7" fill="#b60">S</text>
        <text x="120" y="-6" textAnchor="start" fontSize="8" fill="#333">O=S=O</text>
        <text x="127" y="10" textAnchor="start" fontSize="8" fill="#333">OH</text>
        <line x1="100" y1="0" x2="118" y2="-4" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  13: () => (
    <svg viewBox="0 0 200 130" width="140" height="90">
      <g transform="translate(15,20)">
        <polygon points="0,-18 15,-9 15,9 0,18 -15,9 -15,-9" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(25,55)"/>
        <text x="60" y="35" textAnchor="middle" fontSize="8" fill="#333">N</text>
        <text x="90" y="35" textAnchor="middle" fontSize="8" fill="#333">N</text>
        <line x1="40" y1="38" x2="55" y2="38" stroke="#333" strokeWidth="1.2"/>
        <line x1="65" y1="38" x2="85" y2="38" stroke="#333" strokeWidth="1.2"/>
        <line x1="95" y1="38" x2="110" y2="38" stroke="#333" strokeWidth="1.2"/>
        <circle cx="75" cy="55" r="12" fill="none" stroke="#b87333" strokeWidth="2"/>
        <text x="75" y="59" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#b87333">Cu</text>
        <polygon points="0,-18 15,-9 15,9 0,18 -15,9 -15,-9" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(125,55)"/>
        <text x="15" y="70" fontSize="7" fill="#333">NaO&#8323;S</text>
        <text x="100" y="35" textAnchor="start" fontSize="7" fill="#333">SO&#8323;Na</text>
      </g>
    </svg>
  ),
  14: () => (
    <svg viewBox="0 0 120 130" width="90" height="95">
      <g transform="translate(60,60)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
        <text x="0" y="-36" textAnchor="middle" fontSize="8" fill="#333">COOH</text>
        <line x1="0" y1="-28" x2="0" y2="-33" stroke="#333" strokeWidth="1.2"/>
        <text x="30" y="-18" textAnchor="start" fontSize="8" fill="#1a6">NH&#8322;</text>
        <line x1="24" y1="-14" x2="30" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="0" y="40" textAnchor="middle" fontSize="8" fill="#333">SO&#8323;H</text>
        <line x1="0" y1="28" x2="0" y2="33" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  15: () => (
    <svg viewBox="0 0 130 130" width="95" height="95">
      <g transform="translate(65,60)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
        <text x="0" y="-36" textAnchor="middle" fontSize="8" fill="#333">COOH</text>
        <line x1="0" y1="-28" x2="0" y2="-33" stroke="#333" strokeWidth="1.2"/>
        <text x="30" y="-18" textAnchor="start" fontSize="8" fill="#1a6">NH&#8322;</text>
        <line x1="24" y1="-14" x2="30" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="-36" y="18" textAnchor="end" fontSize="8" fill="#333">HO&#8323;S</text>
        <line x1="-24" y1="14" x2="-32" y2="18" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  16: () => (
    <svg viewBox="0 0 200 120" width="140" height="85">
      <g transform="translate(10,55)">
        <polygon points="0,-20 17,-10 17,10 0,20 -17,10 -17,-10" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(25,0)"/>
        <circle cx="25" cy="0" r="10" fill="none" stroke="#333" strokeWidth="0.8"/>
        <text x="10" y="-28" fontSize="7" fill="#333">HOOC</text>
        <line x1="15" y1="-20" x2="10" y2="-25" stroke="#333" strokeWidth="1.2"/>
        <text x="10" y="30" fontSize="7" fill="#333">SO&#8323;H</text>
        <line x1="15" y1="20" x2="10" y2="26" stroke="#333" strokeWidth="1.2"/>
        <text x="50" y="-5" textAnchor="middle" fontSize="8" fill="#333">NH&#8212;N=CH&#8212;</text>
        <line x1="42" y1="0" x2="55" y2="0" stroke="#333" strokeWidth="1.2"/>
        <polygon points="0,-20 17,-10 17,10 0,20 -17,10 -17,-10" fill="none" stroke="#333" strokeWidth="1.5" transform="translate(140,0)"/>
        <circle cx="140" cy="0" r="10" fill="none" stroke="#333" strokeWidth="0.8"/>
        <line x1="90" y1="0" x2="123" y2="0" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
  17: () => (
    <svg viewBox="0 0 120 130" width="90" height="95">
      <g transform="translate(60,60)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill="none" stroke="#333" strokeWidth="1.5"/>
        <circle cx="0" cy="0" r="14" fill="none" stroke="#333" strokeWidth="1"/>
        <text x="0" y="-36" textAnchor="middle" fontSize="8" fill="#333">SO&#8323;H</text>
        <line x1="0" y1="-28" x2="0" y2="-33" stroke="#333" strokeWidth="1.2"/>
        <text x="30" y="-18" textAnchor="start" fontSize="8" fill="#555">Me</text>
        <line x1="24" y1="-14" x2="30" y2="-18" stroke="#333" strokeWidth="1.2"/>
        <text x="0" y="40" textAnchor="middle" fontSize="8" fill="#c00">O&#8322;N</text>
        <line x1="0" y1="28" x2="0" y2="33" stroke="#333" strokeWidth="1.2"/>
      </g>
    </svg>
  ),
}

// â”€â”€â”€ INQUIRY MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const InquiryModal = ({ product, onClose }: { product: Product | null; onClose: () => void }) => {
  const [form, setForm] = useState({ name: '', email: '', company: '', quantity: '', message: '' })
  const [sent, setSent] = useState(false)
  if (!product) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-blue-900 px-8 py-5 flex justify-between items-start">
          <div>
            <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">Product Inquiry</p>
            <h2 className="text-white font-black text-xl leading-tight">{product.name}</h2>
            <p className="text-gray-300 text-xs mt-1">{product.fullname}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white mt-1"><X size={22} /></button>
        </div>
        {sent ? (
          <div className="px-8 py-12 text-center">
            <div className="text-5xl mb-4">&#10003;</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Inquiry Sent!</h3>
            <p className="text-gray-600 mb-6">Thank you. Our team will contact you shortly.</p>
            <button onClick={onClose} className="bg-slate-900 text-white font-bold py-3 px-8 rounded-lg">Close</button>
          </div>
        ) : (
          <div className="px-8 py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="you@company.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company</label>
                <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Company name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantity Required</label>
                <input value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="e.g. 500 kg" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Message</label>
              <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={3} className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Any specific requirements..." />
            </div>
            <button onClick={() => setSent(true)} className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 rounded-lg transition-all duration-300 text-sm">
              Submit Inquiry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// â”€â”€â”€ LOGO (base64) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const logoSrc = "data:image/jpeg;base64,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"

// â”€â”€â”€ MAIN COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function MadstoqWebsite() {
  const [currentPage, setCurrentPage] = useState('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [inquiryProduct, setInquiryProduct] = useState<Product | null>(null)

  const products: Product[] = [
    { sr: 1,  name: 'OPASA',                     fullname: 'Ortho Amino Phenol-4-Sulfonic Acid',                 mw: '189',    cas: '98-37-3',     purity: '92%' },
    { sr: 2,  name: '6 ACETYL OAPSA',            fullname: '6 Acetyl 2 (Ortho) Amino Phenol 4 Sulphonic Acid', mw: '246.2',  cas: '40306-75-0',  purity: '83%' },
    { sr: 3,  name: '4 NAPSA',                   fullname: '4-Nitro-2-Amino Phenol-6-Sulfonic Acid',            mw: '234',    cas: '96-67-3',     purity: '83%' },
    { sr: 4,  name: '6 NAPSA',                   fullname: '6-Nitro-2-Amino Phenol-4-Sulfonic Acid',            mw: '234',    cas: '96-93-5',     purity: '75%' },
    { sr: 5,  name: 'PNCBOSA',                   fullname: 'Para Nitro Chloro Benzene Ortho Sulfonic Acid',     mw: '237.5',  cas: '946-30-5',    purity: '74%' },
    { sr: 6,  name: '4 NADPSA',                  fullname: "4'-Amino-4-Nitro Diphenylamine-2-Sulfonic Acid",   mw: '309',    cas: '91-29-2',     purity: '89%' },
    { sr: 7,  name: 'PAABSA',                    fullname: 'Para Amino Azo Benzene-4-Sulfonic Acid',            mw: '277',    cas: '102-23-8',    purity: '94%' },
    { sr: 8,  name: 'METANILIC ACID',            fullname: '1 Amino Benzene 3, Sulphonic Acid',                 mw: '173.19', cas: '121-47-1',    purity: '98%' },
    { sr: 9,  name: 'HEGN BASE STAGE -1,2,3',   fullname: 'HEGN Intermediate Base Stage',                      mw: '703',    cas: '60316-87-2',  purity: '-'   },
    { sr: 10, name: 'BLUE 49 BASE',              fullname: 'Blue Reactive Dye Base',                            mw: '575',    cas: '24124-40-1',  purity: '75%' },
    { sr: 11, name: 'PPDDSA',                    fullname: 'Para Phenylene Diamine-2,5-Disulfonic Acid',        mw: '268',    cas: '7139-89-1',   purity: '98%' },
    { sr: 12, name: 'DTPTSA',                    fullname: 'Dehydrothio-p-toluidine Sulfonic Acid',             mw: '320.39', cas: '130-17-6',    purity: '86%' },
    { sr: 13, name: 'COPPER FORMAZONE',          fullname: 'BASE OF RE. BLUE 221',                              mw: '641',    cas: '77840-01-8',  purity: '57%' },
    { sr: 14, name: '4 SULPHO ANTHRANILIC ACID', fullname: '2-Amino-4-Sulfo Benzoic Acid',                     mw: '217',    cas: '98-43-1',     purity: '63%' },
    { sr: 15, name: '5 SULPHO ANTHRANILIC ACID', fullname: '2-Amino-5-Sulfo Benzoic Acid',                     mw: '217',    cas: '3577-63-7',   purity: '85%' },
    { sr: 16, name: '4 SULPHO HYDRAZONE',        fullname: 'Hydrazone of 4-Sulpho Anthranilic Acid',           mw: '320',    cas: '118969-29-2', purity: '70%' },
    { sr: 17, name: 'PNTOSA',                    fullname: 'Para Nitro Toluene Ortho Sulphonic Acid',           mw: '217.21', cas: '121-03-9',    purity: '82%' },
  ]

  const navItems = [
    { id: 'home',           label: 'Home' },
    { id: 'about',          label: 'About Us' },
    { id: 'products',       label: 'Products' },
    { id: 'infrastructure', label: 'Infrastructure' },
    { id: 'contact',        label: 'Contact' },
  ]

  const Navigation = () => (
    <nav className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div onClick={() => { setCurrentPage('home'); setMobileMenuOpen(false) }} className="flex items-center gap-3 cursor-pointer">
            <img src={logoSrc} alt="MADSToQ" style={{ height: '52px', width: 'auto' }} />
          </div>
          <div className="hidden md:flex items-center gap-8">
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setCurrentPage(item.id); setMobileMenuOpen(false) }}
                className={`text-sm font-semibold transition-all duration-300 ${currentPage === item.id ? 'text-cyan-400 border-b-2 border-cyan-400 pb-1' : 'text-gray-300 hover:text-cyan-400'}`}>
                {item.label}
              </button>
            ))}
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-white p-2 hover:bg-slate-700 rounded-lg transition-colors relative z-[60]" aria-label="Toggle menu" aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer (slides from right) */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>
      <aside
        className={`md:hidden fixed top-0 right-0 h-full w-72 max-w-[82vw] z-50 bg-gradient-to-b from-slate-900 to-slate-800 shadow-2xl border-l border-slate-700 transform transition-transform duration-300 ease-out ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col h-full pt-20 pb-6">
          <nav className="flex-1 overflow-y-auto px-2">
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setCurrentPage(item.id); setMobileMenuOpen(false) }}
                className={`block w-full text-left px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${currentPage === item.id ? 'text-cyan-400 bg-slate-700/70' : 'text-gray-300 hover:text-cyan-400 hover:bg-slate-700/50'}`}>
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </nav>
  )

  const CoreTeamSection = () => (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-sm uppercase tracking-widest text-gray-500 text-center mb-2">OUR LEADERSHIP</h2>
        <h3 className="text-4xl font-black text-center text-slate-900 mb-3">FOUNDING MEMBERS & PARTNERS</h3>
        <div className="w-16 h-1 bg-cyan-400 mx-auto mb-12 rounded-full"></div>
        <div className="grid md:grid-cols-2 gap-12 max-w-2xl mx-auto">
          {[
            { name: 'Nisarg Trivedi', role: 'Director', contact: '+91 63546 65395' },
            { name: 'Vishnu Patel',   role: 'Director',   contact: '+91 97268 64012' },
          ].map((member, idx) => (
            <div key={idx} className="bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-2xl text-center border border-gray-200 shadow-lg">
              <div className="w-24 h-24 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full mx-auto mb-6 flex items-center justify-center text-white font-black text-3xl shadow-lg">
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">{member.name}</h3>
              <p className="text-blue-600 font-semibold mb-3">{member.role}</p>
              <p className="text-sm text-gray-600">{member.contact}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )

  const SalesNetworkSection = () => (
    <section className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src="/image.png" alt="Global" className="w-7 h-7 opacity-80" />
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500 text-center">WE ARE GLOBAL</p>
        </div>
        <h3 className="text-4xl font-black text-center text-slate-900 mb-10">SALES NETWORK</h3>
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <WorldMapSVG />
        </div>
      </div>
    </section>
  )

  const HomePage = () => (
    <div>
      <div className="relative h-96 md:h-screen bg-cover bg-center" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200&q=80")' }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70"></div>
        <div className="relative h-full flex items-center justify-center">
          <div className="text-center text-white z-10 px-4">
            <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              THE CHEMISTRY OF <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">EXCELLENCE</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              MADSToQ delivers premium chemical intermediates for dye manufacturing industries worldwide.
            </p>
            <button onClick={() => setCurrentPage('products')}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105">
              View Products
            </button>
          </div>
        </div>
      </div>
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-black text-slate-900 mb-6">WELCOME TO MADSToQ</h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                MADSToQ is a globally renowned manufacturer and exporter of premium chemical intermediates for the dye and pigment industry.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                Our team is united by a vision of &quot;Delivering Excellence Daily&quot;. We fulfill our duty of delivering products that meet the economic needs of the industry while maintaining the highest environmental standards.
              </p>
              <button onClick={() => setCurrentPage('about')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                Learn More About Us
              </button>
            </div>
            <div className="bg-gradient-to-br from-cyan-100 to-blue-100 rounded-2xl p-8 h-80 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">&#9878;</div>
                <p className="text-slate-700 font-semibold text-lg">Chemical Intermediates</p>
                <p className="text-gray-600 text-sm mt-2">Quality & Innovation</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-slate-900 to-blue-900 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { number: '30+',  label: 'Years of Experience' },
              { number: '17',   label: 'Intermediate Products' },
              { number: '500+', label: 'Happy Clients' },
              { number: '50K+', label: 'MT Annual Capacity' },
            ].map((stat, idx) => (
              <div key={idx} className="transform hover:scale-110 transition-transform duration-300">
                <p className="text-5xl font-black text-cyan-400 mb-2">{stat.number}</p>
                <p className="text-gray-300 font-semibold text-sm md:text-base">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CoreTeamSection />
      <SalesNetworkSection />
    </div>
  )

  const AboutPage = () => (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-5xl font-black mb-4">About MADSToQ</h1>
          <p className="text-xl text-cyan-400">Building Excellence Since 2020</p>
        </div>
      </div>
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-black text-slate-900 mb-6">Our Story</h2>
              <p className="text-gray-700 mb-4 text-lg leading-relaxed">
                MADSToQ was established with a vision to become a leading chemical intermediate manufacturer globally. With 30+ years of industry experience, we have built a reputation for quality, innovation, and customer satisfaction.
              </p>
              <p className="text-gray-700 mb-4 text-lg leading-relaxed">
                Our journey spans from humble beginnings to becoming a trusted partner for hundreds of industrial clients across multiple continents.
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl h-96 flex items-center justify-center">
              <div className="text-center text-white">
                <p className="text-6xl font-black mb-2">30+</p>
                <p className="text-2xl font-bold">Years of Excellence</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <CoreTeamSection />
    </div>
  )

  const ProductsPage = () => (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-5xl font-black mb-4">Our Intermediate Products</h1>
          <p className="text-xl text-cyan-400">Premium chemical intermediates for dye manufacturing</p>
        </div>
      </div>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-black text-slate-900 mb-4 text-center">Chemical Intermediates</h2>
          <p className="text-center text-gray-700 max-w-2xl mx-auto mb-10">17 premium intermediates for dyes, pigments & specialty chemicals.</p>
          <div className="overflow-x-auto rounded-xl shadow-lg">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-slate-900 to-blue-900 text-white">
                  <th className="border border-gray-700 px-3 py-3 text-left font-bold">Sr.</th>
                  <th className="border border-gray-700 px-3 py-3 text-left font-bold">Product Name</th>
                  <th className="border border-gray-700 px-3 py-3 text-left font-bold">M.W.</th>
                  <th className="border border-gray-700 px-3 py-3 text-left font-bold">CAS No.</th>
                  <th className="border border-gray-700 px-3 py-3 text-left font-bold">Purity (Min)</th>
                  <th className="border border-gray-700 px-3 py-3 text-center font-bold">Structure</th>
                  <th className="border border-gray-700 px-3 py-3 text-center font-bold">Inquiry</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => {
                  const StructComp = structures[p.sr]
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                      <td className="border border-gray-200 px-3 py-3 font-semibold text-slate-900 text-center">{p.sr}</td>
                      <td className="border border-gray-200 px-3 py-3">
                        <div className="font-bold text-slate-900 text-xs md:text-sm">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{p.fullname}</div>
                      </td>
                      <td className="border border-gray-200 px-3 py-3 text-slate-900 text-xs font-mono">{p.mw}</td>
                      <td className="border border-gray-200 px-3 py-3 text-slate-900 text-xs font-mono">{p.cas}</td>
                      <td className="border border-gray-200 px-3 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                          parseInt(p.purity) >= 90 ? 'bg-green-100 text-green-700' :
                          parseInt(p.purity) >= 75 ? 'bg-blue-100 text-blue-700' :
                          p.purity === '-' ? 'bg-gray-100 text-gray-500' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{p.purity}</span>
                      </td>
                      <td className="border border-gray-200 px-2 py-2 text-center">
                        <div className="flex items-center justify-center">
                          {StructComp ? <StructComp /> : <span className="text-gray-400 text-xs italic">Complex</span>}
                        </div>
                      </td>
                      <td className="border border-gray-200 px-3 py-3 text-center">
                        <button onClick={() => setInquiryProduct(p)}
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md">
                          Inquire
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )

  const InfrastructurePage = () => (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-5xl font-black mb-4">Our Infrastructure</h1>
          <p className="text-xl text-cyan-400">State-of-the-art facilities and capabilities</p>
        </div>
      </div>
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-black text-slate-900 mb-12 text-center">Manufacturing Facilities</h2>
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              { title: 'Production Units',  desc: 'Advanced manufacturing facilities with modern machinery and quality control systems', icon: 'ðŸ­' },
              { title: 'R&D Laboratory',    desc: 'Equipped with cutting-edge analytical instruments for product development and testing', icon: 'ðŸ”¬' },
              { title: 'Quality Assurance', desc: 'ISO certified testing and quality management protocols', icon: 'âœ“' },
            ].map((f, idx) => (
              <div key={idx} className="bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-xl shadow-lg">
                <div className="text-5xl mb-4">{f.icon}</div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-gray-700">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 text-white rounded-2xl p-12">
            <h3 className="text-3xl font-black mb-8 text-center">Capacity & Capabilities</h3>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                { label: 'Annual Production',      value: '50,000+ MT' },
                { label: 'Storage Capacity',       value: '5,000+ MT' },
                { label: 'Quality Certifications', value: 'ISO 9001, ISO 14001' },
                { label: 'Packaging Options',      value: 'Bulk to Retail' },
              ].map((item, idx) => (
                <div key={idx} className="border-l-4 border-cyan-400 pl-6">
                  <p className="text-gray-300 mb-2">{item.label}</p>
                  <p className="text-3xl font-black text-cyan-400">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )

  const ContactPage = () => (
    <div>
      <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-5xl font-black mb-4">Get In Touch</h1>
          <p className="text-xl text-cyan-400">{"We'd love to hear from you"}</p>
        </div>
      </div>
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-8">Contact Information</h2>
              <div className="flex items-start gap-4 mb-6">
                <MapPin className="text-blue-600 mt-1 flex-shrink-0" size={24} />
                <div>
                  <h3 className="font-bold text-slate-900 mb-2">Headquarters</h3>
                  <p className="text-gray-700">Survey no : 480 & 361, Vaduchi Mata Khambhat Road, Neja, Anand 388620, Gujarat, India</p>
                </div>
              </div>
              <div className="flex items-start gap-4 mb-6">
                <Mail className="text-blue-600 mt-1 flex-shrink-0" size={24} />
                <div>
                  <h3 className="font-bold text-slate-900 mb-2">Email</h3>
                  <p className="text-gray-700">inquires@madstoq.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Phone className="text-blue-600 mt-1 flex-shrink-0" size={24} />
                <div>
                  <h3 className="font-bold text-slate-900 mb-2">Phone</h3>
                  <p className="text-gray-700">+91 63546 65395</p>
                  <p className="text-gray-700">+91 97268 64012</p>
                </div>
              </div>
              <div className="mt-10 pt-10 border-t-2 border-gray-200">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Follow Us</h3>
                <div className="flex gap-4">
                  {[Facebook, Twitter, Linkedin, Instagram].map((Icon, idx) => (
                    <button key={idx} className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-colors">
                      <Icon size={20} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-2xl">
              <h2 className="text-3xl font-bold text-slate-900 mb-8">Send us a Message</h2>
              <div className="space-y-6">
                {[
                  { label: 'Full Name', type: 'text',  placeholder: 'Your name' },
                  { label: 'Email',     type: 'email', placeholder: 'your@email.com' },
                ].map((f, i) => (
                  <div key={i}>
                    <label className="block text-slate-900 font-semibold mb-2">{f.label}</label>
                    <input type={f.type} className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600" placeholder={f.placeholder} />
                  </div>
                ))}
                <div>
                  <label className="block text-slate-900 font-semibold mb-2">Product Interest</label>
                  <select className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600">
                    <option>Select a product</option>
                    {products.map(p => <option key={p.sr}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-900 font-semibold mb-2">Message</label>
                  <textarea className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600" rows={4} placeholder="Your message"></textarea>
                </div>
                <button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-3 rounded-lg transition-all duration-300">
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )

  const Footer = () => (
    <footer className="bg-slate-900 text-gray-300 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-white font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {navItems.map(link => (
                <li key={link.id}><button onClick={() => setCurrentPage(link.id)} className="hover:text-cyan-400 transition-colors">{link.label}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4">Products</h3>
            <ul className="space-y-2">
              {['Chemical Intermediates', 'Aminophenols', 'Sulphonic Acids', 'Aromatic Amines'].map(p => (
                <li key={p}><a href="#" className="hover:text-cyan-400 transition-colors">{p}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4">Company</h3>
            <ul className="space-y-2">
              {['About Us', 'Infrastructure', 'Careers', 'Blog'].map(c => (
                <li key={c}><a href="#" className="hover:text-cyan-400 transition-colors">{c}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4">Connect</h3>
            <ul className="space-y-2">
              <li className="hover:text-cyan-400 cursor-pointer">inquires@madstoq.com</li>
              <li className="hover:text-cyan-400 cursor-pointer">+91 63546 65395</li>
              <li className="hover:text-cyan-400 cursor-pointer">+91 97268 64012</li>
              <li className="hover:text-cyan-400 cursor-pointer">Anand, Gujarat, India</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-700 pt-8 text-center">
          <p>&copy; 2026 MADSToQ. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  )

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      {currentPage === 'home'           && <HomePage />}
      {currentPage === 'about'          && <AboutPage />}
      {currentPage === 'products'       && <ProductsPage />}
      {currentPage === 'infrastructure' && <InfrastructurePage />}
      {currentPage === 'contact'        && <ContactPage />}
      <Footer />
      {inquiryProduct && <InquiryModal product={inquiryProduct} onClose={() => setInquiryProduct(null)} />}
    </div>
  )
}

