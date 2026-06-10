'use client'

import { useEffect, useMemo, useState } from 'react'

const DOPAMINE_COLORS = [
	'#FF6B9D',
	'#FF8A80',
	'#FF5252',
	'#FFD740',
	'#FFAB00',
	'#FF6D00',
	'#69F0AE',
	'#00E676',
	'#00BFA5',
	'#40C4FF',
	'#448AFF',
	'#7C4DFF',
	'#E040FB',
	'#FF4081',
	'#FF3D00',
	'#00E5FF',
	'#76FF03',
	'#FFEA00'
]

interface BubbleConfig {
	id: number
	left: string
	width: number
	height: number
	borderTopLeftRadius: string
	borderTopRightRadius: string
	borderBottomLeftRadius: string
	borderBottomRightRadius: string
	colorIndex: number
	animationDuration: string
	animationDelay: string
	fontSize: number
}

interface BubbleItem extends BubbleConfig {
	color: string
	char: string
}

function pickColor(index: number) {
	return DOPAMINE_COLORS[index % DOPAMINE_COLORS.length]
}

function randomChar() {
	return String.fromCharCode(65 + Math.floor(Math.random() * 26))
}

const BASE_CONFIG: BubbleConfig[] = [
	{ id: 1, left: '5%', width: 41, height: 41, borderTopLeftRadius: '50%', borderTopRightRadius: '50%', borderBottomLeftRadius: '50%', borderBottomRightRadius: '50%', colorIndex: 0, animationDuration: '28s', animationDelay: '0s', fontSize: 12 },
	{ id: 2, left: '15%', width: 60, height: 60, borderTopLeftRadius: '30%', borderTopRightRadius: '70%', borderBottomLeftRadius: '70%', borderBottomRightRadius: '30%', colorIndex: 1, animationDuration: '20s', animationDelay: '1s', fontSize: 15 },
	{ id: 3, left: '28%', width: 41, height: 41, borderTopLeftRadius: '40%', borderTopRightRadius: '40%', borderBottomLeftRadius: '40%', borderBottomRightRadius: '40%', colorIndex: 2, animationDuration: '32s', animationDelay: '3s', fontSize: 14 },
	{ id: 4, left: '40%', width: 53, height: 53, borderTopLeftRadius: '0%', borderTopRightRadius: '0%', borderBottomLeftRadius: '0%', borderBottomRightRadius: '0%', colorIndex: 3, animationDuration: '22s', animationDelay: '0s', fontSize: 17 },
	{ id: 5, left: '52%', width: 38, height: 38, borderTopLeftRadius: '10%', borderTopRightRadius: '90%', borderBottomLeftRadius: '10%', borderBottomRightRadius: '90%', colorIndex: 4, animationDuration: '26s', animationDelay: '5s', fontSize: 11 },
	{ id: 6, left: '65%', width: 75, height: 75, borderTopLeftRadius: '60%', borderTopRightRadius: '60%', borderBottomLeftRadius: '20%', borderBottomRightRadius: '20%', colorIndex: 5, animationDuration: '18s', animationDelay: '2s', fontSize: 18 },
	{ id: 7, left: '78%', width: 49, height: 49, borderTopLeftRadius: '50%', borderTopRightRadius: '0%', borderBottomLeftRadius: '50%', borderBottomRightRadius: '0%', colorIndex: 6, animationDuration: '24s', animationDelay: '4s', fontSize: 14 },
	{ id: 8, left: '22%', width: 34, height: 34, borderTopLeftRadius: '20%', borderTopRightRadius: '20%', borderBottomLeftRadius: '80%', borderBottomRightRadius: '80%', colorIndex: 7, animationDuration: '30s', animationDelay: '1s', fontSize: 9 },
	{ id: 9, left: '48%', width: 41, height: 26, borderTopLeftRadius: '50%', borderTopRightRadius: '50%', borderBottomLeftRadius: '50%', borderBottomRightRadius: '50%', colorIndex: 8, animationDuration: '28s', animationDelay: '6s', fontSize: 8 },
	{ id: 10, left: '35%', width: 64, height: 64, borderTopLeftRadius: '5%', borderTopRightRadius: '5%', borderBottomLeftRadius: '5%', borderBottomRightRadius: '5%', colorIndex: 9, animationDuration: '16s', animationDelay: '3s', fontSize: 15 },
	{ id: 11, left: '60%', width: 30, height: 45, borderTopLeftRadius: '30%', borderTopRightRadius: '30%', borderBottomLeftRadius: '30%', borderBottomRightRadius: '30%', colorIndex: 10, animationDuration: '26s', animationDelay: '0s', fontSize: 10 },
	{ id: 12, left: '85%', width: 45, height: 45, borderTopLeftRadius: '50%', borderTopRightRadius: '50%', borderBottomLeftRadius: '0%', borderBottomRightRadius: '0%', colorIndex: 11, animationDuration: '20s', animationDelay: '2s', fontSize: 12 },
	{ id: 13, left: '12%', width: 53, height: 38, borderTopLeftRadius: '80%', borderTopRightRadius: '80%', borderBottomLeftRadius: '10%', borderBottomRightRadius: '10%', colorIndex: 12, animationDuration: '22s', animationDelay: '5s', fontSize: 11 },
	{ id: 14, left: '72%', width: 41, height: 41, borderTopLeftRadius: '15%', borderTopRightRadius: '15%', borderBottomLeftRadius: '85%', borderBottomRightRadius: '85%', colorIndex: 13, animationDuration: '32s', animationDelay: '1s', fontSize: 11 },
	{ id: 15, left: '90%', width: 38, height: 53, borderTopLeftRadius: '40%', borderTopRightRadius: '40%', borderBottomLeftRadius: '40%', borderBottomRightRadius: '40%', colorIndex: 14, animationDuration: '24s', animationDelay: '4s', fontSize: 10 }
]

export default function Bubbles() {
	const bubbles = useMemo<BubbleItem[]>(() => {
		return BASE_CONFIG.map(config => ({
			...config,
			color: pickColor(config.colorIndex),
			char: randomChar()
		}))
	}, [])

	return (
		<div className='fixed inset-0 z-0 overflow-hidden'>
			<style>
				{`
          @keyframes bubbles-rise {
            0% {
              opacity: 0.1;
              transform: translateY(0) rotate(0deg);
            }
            25% {
              opacity: 0.25;
              transform: translateY(-350px) rotate(60deg);
            }
            50% {
              opacity: 0.7;
              transform: translateY(-550px) rotate(120deg);
            }
            75% {
              opacity: 0.1;
              transform: translateY(-750px) rotate(240deg);
            }
            100% {
              opacity: 0;
              transform: translateY(-1000px) rotate(360deg);
            }
          }
        `}
			</style>
			<ul className='relative h-full w-full'>
				{bubbles.map(item => (
					<li
						key={item.id}
						className='absolute flex items-center justify-center font-bold text-white'
						style={{
							bottom: '-200px',
							left: item.left,
							width: item.width,
							height: item.height,
							borderTopLeftRadius: item.borderTopLeftRadius,
							borderTopRightRadius: item.borderTopRightRadius,
							borderBottomLeftRadius: item.borderBottomLeftRadius,
							borderBottomRightRadius: item.borderBottomRightRadius,
							backgroundColor: item.color,
							animationName: 'bubbles-rise',
							animationDuration: item.animationDuration,
							animationDelay: item.animationDelay,
							animationIterationCount: 'infinite',
							animationTimingFunction: 'linear',
							fontSize: item.fontSize,
							boxShadow: `0 0 20px ${item.color}66`
						}}>
						{item.char}
					</li>
				))}
			</ul>
		</div>
	)
}
