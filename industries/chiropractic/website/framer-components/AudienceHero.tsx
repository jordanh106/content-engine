import { useState, type CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

/**
 * Audience Hero
 * The home page hero with Pregnancy / Babies & kids / Whole family chips.
 * Tapping a chip swaps the headline, subline, photo, booking button and
 * fee line in place. Selection is also broadcast as a window event
 * ("cfc:audience") so the Sticky Booking Bar can match its button.
 *
 * Fonts: add Instrument Serif and Figtree to the project (Google Fonts in
 * Framer's font picker) so they load on the published site.
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 */

type Audience = {
    label: string
    before: string
    accent: string
    after: string
    sub: string
    cta: string
    ctaLink: string
    fee: string
    image?: { src: string; srcSet?: string; alt?: string }
    imageAlt: string
}

type Props = {
    eyebrow: string
    audiences: Audience[]
    defaultIndex: number
    phoneLabel: string
    phoneNumber: string
    doctorName: string
    doctorCredentials: string
    doctorPhoto?: { src: string; srcSet?: string; alt?: string }
    videoLabel: string
    videoLink: string
    colors: { ink: string; soft: string; pine: string; oat: string; paper: string; blush: string; clayInk: string }
    serif: string
    sans: string
    headlineSize: number
}

export default function AudienceHero(props: Props) {
    const {
        eyebrow, audiences, defaultIndex, phoneLabel, phoneNumber, doctorName,
        doctorCredentials, doctorPhoto, videoLabel, videoLink, colors: c, serif, sans, headlineSize,
    } = props
    const list: Audience[] = audiences?.length ? audiences : DEFAULT_AUDIENCES
    const [index, setIndex] = useState(Math.min(Math.max(defaultIndex, 0), list.length - 1))
    const reduceMotion = useReducedMotion()
    const a = list[index]

    const pick = (i: number) => {
        setIndex(i)
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("cfc:audience", { detail: { label: list[i].cta, link: list[i].ctaLink } })
            )
        }
    }

    const fade = reduceMotion
        ? {}
        : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.35 } }

    const pill = (on: boolean): CSSProperties => ({
        font: `700 16px ${sans}`,
        padding: "12px 20px",
        minHeight: 44,
        borderRadius: 9999,
        border: `1.5px solid ${on ? c.pine : c.soft}`,
        background: on ? c.pine : "transparent",
        color: on ? c.oat : c.ink,
        cursor: "pointer",
    })

    return (
        <section
            style={{
                width: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexWrap: "wrap",
                gap: 56,
                alignItems: "center",
                fontFamily: sans,
                color: c.ink,
                background: c.paper,
            }}
        >
            <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: c.clayInk }}>
                    {eyebrow}
                </span>
                <div role="group" aria-label="Who is coming in?" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {list.map((item, i) => (
                        <button key={item.label} type="button" aria-pressed={i === index} onClick={() => pick(i)} style={pill(i === index)}>
                            {item.label}
                        </button>
                    ))}
                </div>
                <h1
                    aria-live="polite"
                    style={{
                        margin: 0,
                        fontFamily: serif,
                        fontWeight: 400,
                        fontSize: `clamp(44px, 6vw, ${headlineSize}px)`,
                        lineHeight: 0.98,
                        letterSpacing: "-0.02em",
                        textWrap: "balance" as any,
                    }}
                >
                    {a.before} <em style={{ color: c.pine }}>{a.accent}</em>
                    {a.after}
                </h1>
                <p style={{ margin: 0, fontSize: 20, lineHeight: 1.55, color: c.soft, maxWidth: "34em" }}>{a.sub}</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <a
                        href={a.ctaLink}
                        style={{ background: c.pine, color: c.oat, textDecoration: "none", fontWeight: 700, fontSize: 17, padding: "16px 28px", borderRadius: 9999 }}
                    >
                        {a.cta}
                    </a>
                    <a
                        href={`tel:${phoneNumber.replace(/[^\d+]/g, "")}`}
                        style={{ color: c.ink, textDecoration: "none", fontWeight: 700, fontSize: 17, padding: "15px 26px", borderRadius: 9999, border: `1.5px solid ${c.soft}` }}
                    >
                        {phoneLabel}
                    </a>
                </div>
                <p style={{ margin: 0, fontSize: 15, color: c.soft }}>{a.fee}</p>
            </div>

            <div style={{ flex: "1 1 360px", minWidth: 0, position: "relative", display: "flex", justifyContent: "center" }}>
                <div
                    style={{
                        width: "100%",
                        maxWidth: 500,
                        aspectRatio: "5 / 6",
                        borderRadius: "9999px 9999px 24px 24px",
                        background: c.pine,
                        padding: 14,
                        boxSizing: "border-box",
                        boxShadow: `18px 18px 0 ${c.blush}`,
                        position: "relative",
                    }}
                >
                    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "9999px 9999px 16px 16px", overflow: "hidden" }}>
                        <AnimatePresence initial={false}>
                            {a.image?.src && (
                                <motion.img
                                    key={a.image.src}
                                    src={a.image.src}
                                    srcSet={a.image.srcSet}
                                    alt={a.imageAlt || a.image.alt || ""}
                                    {...fade}
                                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        bottom: 28,
                        background: c.paper,
                        borderRadius: 16,
                        padding: "12px 16px 12px 12px",
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        boxShadow: "0 10px 30px rgba(46,41,36,0.14)",
                    }}
                >
                    {doctorPhoto?.src && (
                        <img src={doctorPhoto.src} srcSet={doctorPhoto.srcSet} alt="" style={{ width: 52, height: 52, borderRadius: 9999, objectFit: "cover" }} />
                    )}
                    <div style={{ lineHeight: 1.3 }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{doctorName}</div>
                        <div style={{ fontSize: 14, color: c.soft }}>{doctorCredentials}</div>
                    </div>
                </div>
                {videoLink && (
                    <a
                        href={videoLink}
                        style={{
                            position: "absolute",
                            right: 8,
                            top: 24,
                            background: c.oat,
                            color: c.ink,
                            fontWeight: 700,
                            fontSize: 14,
                            padding: "10px 16px",
                            borderRadius: 9999,
                            display: "inline-flex",
                            gap: 8,
                            alignItems: "center",
                            textDecoration: "none",
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 4v16l13-8z" fill={c.pine} />
                        </svg>
                        {videoLabel}
                    </a>
                )}
            </div>
        </section>
    )
}

const JANE = "https://thecollectivechiro.janeapp.com/#/new-patient-initial-exams"

const DEFAULT_AUDIENCES: Audience[] = [
    {
        label: "Pregnancy",
        before: "Feel more like",
        accent: "yourself",
        after: " through pregnancy.",
        sub: "Prenatal and postpartum chiropractic with Dr. Ashley, Webster certified, working alongside your OB or midwife.",
        cta: "Book a prenatal visit",
        ctaLink: JANE,
        fee: "Prenatal initial exam · 60 minutes · $125",
        imageAlt: "",
    },
    {
        label: "Babies & kids",
        before: "Gentle care for",
        accent: "little",
        after: " bodies.",
        sub: "From newborns to teens, Dr. Ashley explains every step to you and to your child, and works alongside your pediatrician.",
        cta: "Book a child or teen visit",
        ctaLink: JANE,
        fee: "Child or teen exam · 60 minutes · $99. Infants: call for details.",
        imageAlt: "Dr. Ashley Harper smiling down at a newborn in her arms",
    },
    {
        label: "Whole family",
        before: "Care for the",
        accent: "whole",
        after: " family, in one visit.",
        sub: "Book two to four family members together and leave with a plan for everyone.",
        cta: "Book a family visit",
        ctaLink: JANE,
        fee: "Family groups · from $199 for two",
        imageAlt: "",
    },
]

AudienceHero.defaultProps = {
    eyebrow: "Family chiropractic · Woodstock, GA",
    defaultIndex: 1,
    phoneLabel: "Call (678) 540-8850",
    phoneNumber: "+16785408850",
    doctorName: "Dr. Ashley Harper, DC",
    doctorCredentials: "Webster certified · ICPA trained",
    videoLabel: "15-second hello",
    videoLink: "",
    serif: '"Instrument Serif", Georgia, serif',
    sans: "Figtree, sans-serif",
    headlineSize: 84,
    colors: {
        ink: "#2E2924",
        soft: "#5C534B",
        pine: "#3F5E52",
        oat: "#F3ECDE",
        paper: "#FBF8F1",
        blush: "#E9B8A8",
        clayInk: "#944C38",
    },
    audiences: DEFAULT_AUDIENCES,
}

addPropertyControls(AudienceHero, {
    eyebrow: { type: ControlType.String, title: "Eyebrow" },
    audiences: {
        type: ControlType.Array,
        title: "Audiences",
        maxCount: 4,
        control: {
            type: ControlType.Object,
            controls: {
                label: { type: ControlType.String, title: "Chip" },
                before: { type: ControlType.String, title: "Headline start" },
                accent: { type: ControlType.String, title: "Italic word" },
                after: { type: ControlType.String, title: "Headline end" },
                sub: { type: ControlType.String, title: "Subline", displayTextArea: true },
                cta: { type: ControlType.String, title: "Button" },
                ctaLink: { type: ControlType.Link, title: "Button link" },
                fee: { type: ControlType.String, title: "Fee line" },
                image: { type: ControlType.ResponsiveImage, title: "Photo" },
                imageAlt: { type: ControlType.String, title: "Photo alt text" },
            },
        },
    },
    defaultIndex: { type: ControlType.Number, title: "Default chip", min: 0, max: 3, step: 1, description: "0 = first chip" },
    phoneLabel: { type: ControlType.String, title: "Phone label" },
    phoneNumber: { type: ControlType.String, title: "Phone number" },
    doctorName: { type: ControlType.String, title: "Doctor name" },
    doctorCredentials: { type: ControlType.String, title: "Credentials" },
    doctorPhoto: { type: ControlType.ResponsiveImage, title: "Doctor photo" },
    videoLabel: { type: ControlType.String, title: "Video label" },
    videoLink: { type: ControlType.Link, title: "Video link" },
    headlineSize: { type: ControlType.Number, title: "Headline max", min: 40, max: 120, step: 2, unit: "px" },
    serif: { type: ControlType.String, title: "Serif font" },
    sans: { type: ControlType.String, title: "Sans font" },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        controls: {
            ink: { type: ControlType.Color, title: "Espresso" },
            soft: { type: ControlType.Color, title: "Ink soft" },
            pine: { type: ControlType.Color, title: "Pine" },
            oat: { type: ControlType.Color, title: "Oat" },
            paper: { type: ControlType.Color, title: "Paper" },
            blush: { type: ControlType.Color, title: "Blush" },
            clayInk: { type: ControlType.Color, title: "Clay ink" },
        },
    },
})
