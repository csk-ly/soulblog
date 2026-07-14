'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSize } from '@/hooks/use-size'
import { useConfigStore } from './stores/config-store'
import { useLayoutEditStore } from './stores/layout-edit-store'

const SHIMMER_INTERVAL_MS = 10000

const SHIMMER_ANGLES = [
	{ angle: '115deg', fromX: '-45%', fromY: '-45%', toX: '45%', toY: '45%' },
	{ angle: '65deg', fromX: '45%', fromY: '-45%', toX: '-45%', toY: '45%' },
	{ angle: '-115deg', fromX: '45%', fromY: '45%', toX: '-45%', toY: '-45%' },
	{ angle: '-65deg', fromX: '-45%', fromY: '45%', toX: '45%', toY: '-45%' },
	{ angle: '90deg', fromX: '-45%', fromY: '0%', toX: '45%', toY: '0%' },
	{ angle: '180deg', fromX: '0%', fromY: '-45%', toX: '0%', toY: '45%' }
]

const DOPAMINE_COLORS = [
	'#FF6B6B',
	'#4ECDC4',
	'#45B7D1',
	'#FFA07A',
	'#98D8C8',
	'#F7DC6F',
	'#BB8FCE',
	'#85C1E9',
	'#F8B500',
	'#FF69B4',
	'#00CED1',
	'#FF7F50',
	'#9370DB',
	'#00FA9A',
	'#FFD700'
]

function getRandomColors(count: number): string[] {
	const shuffled = [...DOPAMINE_COLORS].sort(() => Math.random() - 0.5)
	return shuffled.slice(0, count)
}

export interface ShimmerState {
	angle: string
	fromX: string
	fromY: string
	toX: string
	toY: string
	color1: string
	color2: string
	color3: string
	nonce: number
}

interface ShimmerContextValue {
	activeKey: string | null
	shimmer: ShimmerState | null
}

const ShimmerContext = createContext<ShimmerContextValue>({ activeKey: null, shimmer: null })

const CANDIDATE_KEYS = ['hiCard', 'artCard', 'clockCard', 'calendarCard', 'shareCard', 'articleCard', 'beianCard'] as const

type CandidateKey = (typeof CANDIDATE_KEYS)[number]

export function ShimmerProvider({ children }: { children: React.ReactNode }) {
	const { maxSM, init } = useSize()
	const { cardStyles, siteContent } = useConfigStore()
	const editing = useLayoutEditStore(state => state.editing)

	const [activeKey, setActiveKey] = useState<string | null>(null)
	const [shimmer, setShimmer] = useState<ShimmerState | null>(null)
	const lastKeyRef = useRef<string | null>(null)
	const nonceRef = useRef(0)

	const eligibleKeys = useMemo<CandidateKey[]>(() => {
		return CANDIDATE_KEYS.filter(key => {
			const style = cardStyles[key]
			if (!style) return false
			if (style.enabled === false) return false
			if (maxSM) {
				if (key === 'clockCard' || key === 'calendarCard' || key === 'shareCard') return false
			}
			if (key === 'beianCard' && !siteContent.beian?.text) return false
			return true
		})
	}, [cardStyles, maxSM, siteContent.beian?.text])

	useEffect(() => {
		if (!init) return
		if (editing) return
		if (eligibleKeys.length === 0) return

		const tick = () => {
			const pool = eligibleKeys.filter(key => key !== lastKeyRef.current)
			const candidates = pool.length > 0 ? pool : eligibleKeys
			const next = candidates[Math.floor(Math.random() * candidates.length)]
			const preset = SHIMMER_ANGLES[Math.floor(Math.random() * SHIMMER_ANGLES.length)]
			const [color1, color2, color3] = getRandomColors(3)
			nonceRef.current += 1
			lastKeyRef.current = next
			setActiveKey(next)
			setShimmer({ ...preset, color1, color2, color3, nonce: nonceRef.current })
		}

		tick()
		const timer = setInterval(tick, SHIMMER_INTERVAL_MS)
		return () => clearInterval(timer)
	}, [init, editing, eligibleKeys])

	useEffect(() => {
		if (editing) {
			setActiveKey(null)
			setShimmer(null)
		}
	}, [editing])

	const value = useMemo(() => ({ activeKey, shimmer }), [activeKey, shimmer])

	return <ShimmerContext.Provider value={value}>{children}</ShimmerContext.Provider>
}

export function useCardShimmer(cardKey: string | undefined) {
	const { activeKey, shimmer } = useContext(ShimmerContext)
	if (!cardKey || activeKey !== cardKey) return null
	return shimmer
}
