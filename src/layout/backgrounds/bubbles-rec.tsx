'use client'
import { useMemo } from 'react'

const DOPAMINE_COLORS = [
  '#FF6B9D', '#FF8A80', '#FF5252',
  '#FFD740', '#FFAB00', '#FF6D00',
  '#69F0AE', '#00E676', '#00BFA5',
  '#40C4FF', '#448AFF', '#7C4DFF',
  '#E040FB', '#FF4081', '#FF3D00',
  '#00E5FF', '#76FF03', '#FFEA00',
]

interface BubbleItem {
  id: number
  left: string
  width: number
  height: number
  color: string
  animationDuration: string
  animationDelay: string
  fontSize: number
}

function pickColor(index: number) {
  return DOPAMINE_COLORS[index % DOPAMINE_COLORS.length]
}

const BUBBLE_CONFIG: BubbleItem[] = [
  { id: 1, left: '10%', width: 50, height: 50, color: pickColor(0), animationDuration: '15s', animationDelay: '0s', fontSize: 18 },
  { id: 2, left: '20%', width: 90, height: 90, color: pickColor(1), animationDuration: '7s', animationDelay: '2s', fontSize: 18 },
  { id: 3, left: '25%', width: 50, height: 50, color: pickColor(2), animationDuration: '15s', animationDelay: '4s', fontSize: 18 },
  { id: 4, left: '40%', width: 60, height: 60, color: pickColor(3), animationDuration: '8s', animationDelay: '0s', fontSize: 18 },
  { id: 5, left: '70%', width: 50, height: 50, color: pickColor(4), animationDuration: '15s', animationDelay: '0s', fontSize: 18 },
  { id: 6, left: '80%', width: 120, height: 120, color: pickColor(5), animationDuration: '15s', animationDelay: '3s', fontSize: 18 },
  { id: 7, left: '32%', width: 160, height: 160, color: pickColor(6), animationDuration: '15s', animationDelay: '2s', fontSize: 18 },
  { id: 8, left: '55%', width: 40, height: 40, color: pickColor(7), animationDuration: '15s', animationDelay: '4s', fontSize: 12 },
  { id: 9, left: '25%', width: 40, height: 40, color: pickColor(8), animationDuration: '12s', animationDelay: '2s', fontSize: 12 },
  { id: 10, left: '85%', width: 160, height: 160, color: pickColor(9), animationDuration: '15s', animationDelay: '5s', fontSize: 18 },
]

export default function Bubbles({ text = 'Love' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      <style>
        {`
          @keyframes bubbles-rise {
            0% {
              opacity: 0.5;
              transform: translateY(0) rotate(45deg);
            }
            25% {
              opacity: 0.75;
              transform: translateY(-400px) rotate(90deg);
            }
            50% {
              opacity: 1;
              transform: translateY(-600px) rotate(135deg);
            }
            100% {
              opacity: 0;
              transform: translateY(-1000px) rotate(180deg);
            }
          }
        `}
      </style>
      <ul className="relative h-full w-full">
        {BUBBLE_CONFIG.map((item) => (
          <li
            key={item.id}
            className="absolute flex items-center justify-center rounded-xl font-bold text-white"
            style={{
              bottom: '-200px',
              left: item.left,
              width: item.width,
              height: item.height,
              backgroundColor: item.color,
              animationName: 'bubbles-rise',
              animationDuration: item.animationDuration,
              animationDelay: item.animationDelay,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
              fontSize: item.fontSize,
              boxShadow: `0 0 20px ${item.color}66`,
            }}
          >
            {text}
          </li>
        ))}
      </ul>
    </div>
  )
}
