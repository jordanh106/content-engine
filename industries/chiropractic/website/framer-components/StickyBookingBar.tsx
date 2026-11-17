import { useEffect, useState } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

/**
 * Sticky Booking Bar
 * A slim Book + Call bar fixed to the bottom of the screen on phones.
 * Appears after the visitor scrolls past the hero, hides on wider screens,
 * and clears the iPhone home indicator. If an Audience Hero is on the page,
 * the button label and link follow the chip the visitor picked.
 *
 * Place it once per page (or in a shared layout) at the top level, not
 * inside a stack or a frame with a transform, so position: fixed works.
 *
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 */

type Props = {
    bookLabel: string
    bookLink: string
    phoneNumber: string
    showAfter: number
    maxWidth: number
    pine: string
    oat: string
    paper: string
    ink: string
    line: string
    sans: string
}

export default function StickyBookingBar(props: Props) {
    const { bookLabel, bookLink, phoneNumber, showAfter, maxWidth, pine, oat, paper, ink, line, sans } = props
    const onCanvas = RenderTarget.current() === RenderTarget.canvas
    const [visible, setVisible] = useState(false)
    const [narrow, setNarrow] = useState(true)
    const [cta, setCta] = useState({ label: bookLabel, link: bookLink })

    useEffect(() => setCta({ label: bookLabel, link: bookLink }), [bookLabel, bookLink])

    useEffect(() => {
        if (onCanvas) return
        const onScroll = () => setVisible(window.scrollY > showAfter)
        const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
        const onMq = () => setNarrow(mq.matches)
        const onAudience = (e: Event) => {
            const d = (e as CustomEvent).detail
            if (d?.label && d?.link) setCta({ label: d.label, link: d.link })
        }
        onScroll()
        onMq()
        window.addEventListener("scroll", onScroll, { passive: true })
        mq.addEventListener("change", onMq)
        window.addEventListener("cfc:audience", onAudience)
        return () => {
            window.removeEventListener("scroll", onScroll)
            mq.removeEventListener("change", onMq)
            window.removeEventListener("cfc:audience", onAudience)
        }
    }, [onCanvas, showAfter, maxWidth])

    const shown = onCanvas || (narrow && visible)

    const bar = (
        <nav
            aria-label="Book or call"
            aria-hidden={!shown}
            style={{
                position: onCanvas ? "relative" : "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
                boxSizing: "border-box",
                width: "100%",
                display: "flex",
                gap: 10,
                padding: "12px 16px calc(14px + env(safe-area-inset-bottom, 0px))",
                background: paper,
                borderTop: `1px solid ${line}`,
                boxShadow: "0 -8px 24px rgba(46,41,36,0.08)",
                fontFamily: sans,
                transform: shown ? "translateY(0)" : "translateY(110%)",
                transition: "transform 240ms ease",
                pointerEvents: shown ? "auto" : "none",
            }}
        >
            <a
                href={cta.link}
                tabIndex={shown ? 0 : -1}
                style={{
                    flex: 1,
                    textAlign: "center",
                    background: pine,
                    color: oat,
                    textDecoration: "none",
                    fontWeight: 800,
                    fontSize: 16,
                    padding: "14px 0",
                    borderRadius: 9999,
                }}
            >
                {cta.label}
            </a>
            <a
                href={`tel:${phoneNumber.replace(/[^\d+]/g, "")}`}
                aria-label="Call the office"
                tabIndex={shown ? 0 : -1}
                style={{
                    flex: "none",
                    width: 52,
                    height: 52,
                    borderRadius: 9999,
                    background: oat,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
                        stroke={ink}
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinejoin="round"
                    />
                </svg>
            </a>
        </nav>
    )

    return bar
}

StickyBookingBar.defaultProps = {
    bookLabel: "Book a visit",
    bookLink: "https://thecollectivechiro.janeapp.com/#/new-patient-initial-exams",
    phoneNumber: "+16785408850",
    showAfter: 400,
    maxWidth: 809,
    pine: "#3F5E52",
    oat: "#F3ECDE",
    paper: "#FBF8F1",
    ink: "#2E2924",
    line: "#DDD5C6",
    sans: "Figtree, sans-serif",
}

addPropertyControls(StickyBookingBar, {
    bookLabel: { type: ControlType.String, title: "Button" },
    bookLink: { type: ControlType.Link, title: "Button link" },
    phoneNumber: { type: ControlType.String, title: "Phone" },
    showAfter: { type: ControlType.Number, title: "Show after", min: 0, max: 2000, step: 50, unit: "px" },
    maxWidth: { type: ControlType.Number, title: "Phones up to", min: 320, max: 1200, step: 1, unit: "px" },
    pine: { type: ControlType.Color, title: "Button" },
    oat: { type: ControlType.Color, title: "Call circle" },
    paper: { type: ControlType.Color, title: "Bar" },
    ink: { type: ControlType.Color, title: "Icon" },
    line: { type: ControlType.Color, title: "Top border" },
    sans: { type: ControlType.String, title: "Font family" },
})
