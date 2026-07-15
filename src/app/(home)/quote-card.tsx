'use client'

import { useState, useEffect, useRef } from 'react'
import Card from '@/components/card'
import { useCenterStore } from '@/hooks/use-center'
import { useConfigStore } from './stores/config-store'
import { CARD_SPACING } from '@/consts'
import { HomeDraggableLayer } from './home-draggable-layer'

interface Quote {
	text: string
	author: string
}

export default function QuoteCard() {
	const center = useCenterStore()
	const { cardStyles } = useConfigStore()
	const styles = cardStyles.quoteCard
	const hiCardStyles = cardStyles.hiCard
	const articleCardStyles = cardStyles.articleCard
	const socialButtonsStyles = cardStyles.socialButtons
	const shareCardStyles = cardStyles.shareCard

	const [quotes, setQuotes] = useState<Quote[]>([])
	const [currentIndex, setCurrentIndex] = useState(0)
	const [displayText, setDisplayText] = useState('')
	const [phase, setPhase] = useState<'typing' | 'pausing' | 'erasing'>('typing')
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

	// Load quotes from public/quotes.json
	useEffect(() => {
		fetch('/quotes.json')
			.then(res => res.json())
			.then((data: Quote[]) => {
				if (data && data.length > 0) {
					// Shuffle and start
					const shuffled = [...data].sort(() => Math.random() - 0.5)
					setQuotes(shuffled)
				}
			})
			.catch(() => {})
	}, [])

	const currentQuote = quotes[currentIndex]

	// Clear all timers
	const clearTimers = () => {
		timersRef.current.forEach(t => clearTimeout(t))
		timersRef.current = []
	}

	// Typewriter effect
	useEffect(() => {
		if (!currentQuote) return
		clearTimers()

		const fullText = currentQuote.text

		if (phase === 'typing') {
			if (displayText.length < fullText.length) {
				const timer = setTimeout(() => {
					setDisplayText(fullText.slice(0, displayText.length + 1))
				}, 80 + Math.random() * 40)
				timersRef.current.push(timer)
			} else {
				// Finished typing, pause for 3s
				const timer = setTimeout(() => {
					setPhase('erasing')
				}, 3000)
				timersRef.current.push(timer)
			}
		} else if (phase === 'erasing') {
			if (displayText.length > 0) {
				const timer = setTimeout(() => {
					setDisplayText(fullText.slice(0, displayText.length - 1))
				}, 30)
				timersRef.current.push(timer)
			} else {
				// Finished erasing, move to next quote
				setPhase('typing')
				setCurrentIndex(prev => (prev + 1) % quotes.length)
			}
		}

		return clearTimers
	}, [displayText, phase, currentQuote, quotes.length])

	// Position: same x as article card, same y as beian card
	const x = styles.offsetX !== null
		? center.x + styles.offsetX
		: center.x + hiCardStyles.width / 2 - socialButtonsStyles.width - CARD_SPACING - articleCardStyles.width
	const y = styles.offsetY !== null
		? center.y + styles.offsetY
		: center.y + hiCardStyles.height / 2 + CARD_SPACING + shareCardStyles.height

	return (
		<HomeDraggableLayer cardKey='quoteCard' x={x} y={y} width={styles.width} height={styles.height}>
			<Card cardKey='quoteCard' order={styles.order} width={styles.width} height={styles.height} x={x} y={y} className='flex flex-col justify-start p-3 max-sm:static'>
				<div className='text-primary text-xs leading-relaxed'>
					<span className='text-brand/60 mr-1'>"</span>
					{displayText}
					<span className='text-brand ml-0.5 inline-block animate-pulse'>|</span>
					<span className='text-brand/60 ml-0.5'>"</span>
				</div>
				{currentQuote && displayText.length === currentQuote.text.length && (
					<div className='text-secondary mt-1 text-right text-[10px]'>
						—— {currentQuote.author}
					</div>
				)}
			</Card>
		</HomeDraggableLayer>
	)
}
