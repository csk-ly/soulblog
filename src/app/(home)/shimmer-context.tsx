'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSize } from '@/hooks/use-size'
import { useConfigStore } from './stores/config-store'
import { useLayoutEditStore } from './stores/layout-edit-store'

const SHIMMER_INTERVAL_MS = 21000

const SHIMMER_ANGLES = [
	{ angle: '115deg', fromX: '-45%', fromY: '-45%', toX: '45%', toY: '45%' },
	{ angle: '65deg', fromX: '45%', fromY: '-45%', toX: '-45%', toY: '45%' },
	{ angle: '-115deg', fromX: '45%', fromY: '45%', toX: '-45%', toY: '-45%' },
	{ angle: '-65deg', fromX: '-45%', fromY: '45%', toX: '45%', toY: '-45%' },
	{ angle: '90deg', fromX: '-45%', fromY: '0%', toX: '45%', toY: '0%' },
	{ angle: '180deg', fromX: '0%', fromY: '-45%', toX: '0%', toY: '45%' }
]

export interface ShimmerState {
	angle: string
	fromX: string
	fromY: string
	toX: string
	toY: string
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
			nonceRef.current += 1
			lastKeyRef.current = next
			setActiveKey(next)
			setShimmer({ ...preset, nonce: nonceRef.current })
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
