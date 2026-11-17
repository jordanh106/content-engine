import { useEffect, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

/**
 * Office Status
 * Shows "Open now · until 1 PM", "Back at 3:30 PM" or "Opens Tue 9 AM"
 * instead of a bare "Closed now". Times are calculated in the office's
 * time zone, so a visitor in another state still sees Woodstock hours.
 *
 * Hours format, one day per line or separated by ";":
 *   Tue 09:00-13:00, 15:30-18:00
 *   Wed 09:00-13:00
 *
 * @framerSupportedLayoutWidth auto
 * @framerSupportedLayoutHeight auto
 */

type Props = {
    hours: string
    timeZone: string
    openColor: string
    closedColor: string
    textColor: string
    fontSize: number
    fontFamily: string
    fallback: string
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type Range = { start: number; end: number }

export function parseHours(text: string): Range[][] {
    const week: Range[][] = DAYS.map(() => [])
    text.split(/[;\n]/).forEach((line) => {
        const m = line.trim().match(/^([A-Za-z]{3})\s+(.+)$/)
        if (!m) return
        const day = DAYS.findIndex(
            (d) => d.toLowerCase() === m[1].toLowerCase()
        )
        if (day < 0) return
        m[2].split(",").forEach((part) => {
            const r = part.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
            if (!r) return
            week[day].push({
                start: Number(r[1]) * 60 + Number(r[2]),
                end: Number(r[3]) * 60 + Number(r[4]),
            })
        })
        week[day].sort((a, b) => a.start - b.start)
    })
    return week
}

function nowInZone(timeZone: string): { day: number; minutes: number } {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date())
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
    return {
        day: DAYS.indexOf(get("weekday")),
        minutes: Number(get("hour")) * 60 + Number(get("minute")),
    }
}

function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    const suffix = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 === 0 ? 12 : h % 12
    return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`
}

export function getStatus(
    week: Range[][],
    day: number,
    minutes: number
): { open: boolean; label: string } {
    const today = week[day] ?? []
    const current = today.find((r) => minutes >= r.start && minutes < r.end)
    if (current) return { open: true, label: `Open now · until ${formatTime(current.end)}` }

    const laterToday = today.find((r) => r.start > minutes)
    if (laterToday) {
        const opened = today.some((r) => r.end <= minutes)
        return {
            open: false,
            label: `${opened ? "Back at" : "Opens at"} ${formatTime(laterToday.start)}`,
        }
    }

    for (let i = 1; i <= 7; i++) {
        const d = (day + i) % 7
        if (week[d].length) {
            const when = i === 1 ? "tomorrow" : DAYS[d]
            return { open: false, label: `Opens ${when} ${formatTime(week[d][0].start)}` }
        }
    }
    return { open: false, label: "Call for hours" }
}

export default function OfficeStatus(props: Props) {
    const { hours, timeZone, openColor, closedColor, textColor, fontSize, fontFamily, fallback } = props
    // Render the fallback on the server and first paint, then the live status,
    // so the pre-rendered HTML never shows a stale time.
    const [status, setStatus] = useState<{ open: boolean; label: string } | null>(null)

    useEffect(() => {
        const week = parseHours(hours)
        const tick = () => {
            const { day, minutes } = nowInZone(timeZone)
            setStatus(getStatus(week, day, minutes))
        }
        tick()
        const id = window.setInterval(tick, 60_000)
        return () => window.clearInterval(id)
    }, [hours, timeZone])

    return (
        <span
            role="status"
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily,
                fontSize,
                lineHeight: 1.2,
                color: textColor,
                whiteSpace: "nowrap",
            }}
        >
            <span
                aria-hidden="true"
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: 9999,
                    background: status?.open ? openColor : closedColor,
                    flex: "none",
                }}
            />
            {status ? status.label : fallback}
        </span>
    )
}

OfficeStatus.defaultProps = {
    hours: "Tue 09:00-13:00, 15:30-18:00; Wed 09:00-13:00; Thu 09:00-13:00, 15:30-18:00; Fri 09:00-13:00, 15:30-18:00",
    timeZone: "America/New_York",
    openColor: "#3F5E52",
    closedColor: "#C0705A",
    textColor: "#5C534B",
    fontSize: 15,
    fontFamily: "Figtree, sans-serif",
    fallback: "Office hours",
}

addPropertyControls(OfficeStatus, {
    hours: {
        type: ControlType.String,
        title: "Hours",
        displayTextArea: true,
        description: "Day HH:MM-HH:MM, separated by ; (24-hour time)",
    },
    timeZone: { type: ControlType.String, title: "Time zone" },
    openColor: { type: ControlType.Color, title: "Open dot" },
    closedColor: { type: ControlType.Color, title: "Closed dot" },
    textColor: { type: ControlType.Color, title: "Text" },
    fontSize: { type: ControlType.Number, title: "Font size", min: 11, max: 24, step: 1 },
    fontFamily: { type: ControlType.String, title: "Font family" },
    fallback: { type: ControlType.String, title: "Fallback text" },
})
