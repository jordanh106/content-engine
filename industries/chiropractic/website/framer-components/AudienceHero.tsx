import { useState, type CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

/**
 * Audience Hero
 * The current full-bleed home hero, with the audience chips doing real work:
 * tapping Adults & Families, Pregnancy & Postpartum or Babies & Children
 * crossfades the photo and swaps the headline, subline, booking button and
 * fee line in place. It replaces the numbered 01 / 02 / 03 slider.
 *
 * The selection is broadcast as a window event ("cfc:audience") so the
 * Sticky Booking Bar can match its button.
 *
 * Styled to the current build: Geist, white pill primary button, frosted
 * secondary button, forest #264A49. Add Geist from Framer's font picker.
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */

type Img = { src: string; srcSet?: string; alt?: string }

type Audience = {
    label: string
    line1: string
    line2: string
    sub: string
    cta: string
    ctaLink: string
    fee: string
    image?: Img
    imageAlt: string
    focus: string
}

type Props = {
    eyebrow: string
    audiences: Audience[]
    defaultIndex: number
    secondaryLabel: string
    secondaryLink: string
    doctorName: string
    doctorRole: string
    doctorCredentials: string
    doctorPhoto?: Img
    doctorLink: string
    colors: { forest: string; cream: string; chipIdle: string; overlay: string }
    font: string
    headlineSize: number
    radius: number
    style?: CSSProperties
}

export default function AudienceHero(props: Props) {
    const {
        eyebrow, audiences, defaultIndex, secondaryLabel, secondaryLink, doctorName, doctorRole,
        doctorCredentials, doctorPhoto, doctorLink, colors: c, font, headlineSize, radius, style,
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
        : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
    const rise = reduceMotion
        ? {}
        : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }

    const chip = (on: boolean): CSSProperties => ({
        fontFamily: font,
        fontSize: 14,
        fontWeight: 500,
        padding: "13px 18px",
        minHeight: 46,
        borderRadius: 999,
        border: on ? "1px solid #FFFFFF" : `1px solid ${c.chipIdle}`,
        background: on ? "#FFFFFF" : "rgba(255,255,255,0.08)",
        color: on ? c.forest : "#FFFFFF",
        backdropFilter: on ? undefined : "blur(10px)",
        WebkitBackdropFilter: on ? undefined : "blur(10px)",
        cursor: "pointer",
        transition: "background 200ms ease, color 200ms ease",
    })

    return (
        <section
            style={{
                ...style,
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: 640,
                borderRadius: radius,
                overflow: "hidden",
                fontFamily: font,
                color: "#FFFFFF",
                background: c.forest,
            }}
        >
            <AnimatePresence initial={false}>
                {a.image?.src && (
                    <motion.img
                        key={a.image.src}
                        src={a.image.src}
                        srcSet={a.image.srcSet}
                        alt={a.imageAlt || a.image.alt || ""}
                        {...fade}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: a.focus || "50% 50%" }}
                    />
                )}
            </AnimatePresence>
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: c.overlay }} />

            <div
                style={{
                    position: "relative",
                    height: "100%",
                    boxSizing: "border-box",
                    padding: "clamp(20px, 4vw, 48px)",
                    paddingTop: "clamp(88px, 12vh, 120px)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 32,
                }}
            >
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.86)" }}>{eyebrow}</span>

                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.h1
                            key={index}
                            {...rise}
                            aria-live="polite"
                            style={{
                                margin: 0,
                                fontWeight: 400,
                                fontSize: `clamp(44px, 7.2vw, ${headlineSize}px)`,
                                lineHeight: 0.94,
                                letterSpacing: "-0.052em",
                                maxWidth: "14ch",
                                textWrap: "balance" as any,
                            }}
                        >
                            {a.line1}
                            <br />
                            {a.line2}
                        </motion.h1>
                    </AnimatePresence>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 440 }}>
                            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>{a.sub}</p>
                            <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.78)" }}>{a.fee}</p>
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                            <a
                                href={a.ctaLink}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 14,
                                    height: 54,
                                    padding: "0 6px 0 24px",
                                    borderRadius: 999,
                                    background: "#FFFFFF",
                                    color: c.forest,
                                    fontSize: 15,
                                    fontWeight: 500,
                                    letterSpacing: "-0.01em",
                                    textDecoration: "none",
                                }}
                            >
                                {a.cta}
                                <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 999, background: c.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" stroke={c.forest} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </span>
                            </a>
                            <a
                                href={secondaryLink}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    height: 54,
                                    padding: "0 26px",
                                    borderRadius: 999,
                                    background: "rgba(255,255,255,0.08)",
                                    backdropFilter: "blur(10px)",
                                    WebkitBackdropFilter: "blur(10px)",
                                    border: `1px solid ${c.chipIdle}`,
                                    color: "#FFFFFF",
                                    fontSize: 16,
                                    fontWeight: 500,
                                    textDecoration: "none",
                                }}
                            >
                                {secondaryLabel}
                            </a>
                        </div>
                    </div>

                    <div style={{ height: 1, background: "rgba(255,255,255,0.28)" }} />

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end", justifyContent: "space-between" }}>
                        <div role="group" aria-label="Who is coming in?" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {list.map((item, i) => (
                                <button key={item.label} type="button" aria-pressed={i === index} onClick={() => pick(i)} style={chip(i === index)}>
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <a
                            href={doctorLink}
                            style={{
                                display: "flex",
                                gap: 14,
                                alignItems: "center",
                                background: "#FFFFFF",
                                color: "#232323",
                                borderRadius: 18,
                                padding: 8,
                                paddingRight: 16,
                                textDecoration: "none",
                                minWidth: 0,
                                maxWidth: 390,
                            }}
                        >
                            {doctorPhoto?.src && (
                                <img src={doctorPhoto.src} srcSet={doctorPhoto.srcSet} alt="" style={{ width: 84, height: 84, borderRadius: 12, objectFit: "cover", flex: "none" }} />
                            )}
                            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                <span style={{ fontSize: 16, letterSpacing: "-0.01em" }}>{doctorName}</span>
                                <span style={{ fontSize: 13, color: "#425C57" }}>{doctorRole}</span>
                                <span style={{ fontSize: 12, color: "#232323", marginTop: 6 }}>{doctorCredentials}</span>
                            </span>
                        </a>
                    </div>
                </div>
            </div>
        </section>
    )
}

const JANE = "https://thecollectivechiro.janeapp.com/#/new-patient-initial-exams"

const DEFAULT_AUDIENCES: Audience[] = [
    {
        label: "Adults & Families",
        line1: "Family Chiropractic,",
        line2: "with a Gentle Touch.",
        sub: "Chiropractic care for adults, children, and growing families with Dr. Ashley Harper in Woodstock, Georgia.",
        cta: "Book Your First Visit",
        ctaLink: JANE,
        fee: "Adult exam $125 · Family groups from $199",
        imageAlt: "",
        focus: "50% 40%",
    },
    {
        label: "Pregnancy & Postpartum",
        line1: "Feel Like Yourself,",
        line2: "Through Every Trimester.",
        sub: "Prenatal and postpartum care with Dr. Ashley, Webster certified, alongside your OB or midwife.",
        cta: "Book a Prenatal Visit",
        ctaLink: JANE,
        fee: "Prenatal initial exam · 60 min · $125",
        imageAlt: "",
        focus: "50% 25%",
    },
    {
        label: "Babies & Children",
        line1: "Gentle Care,",
        line2: "for Little Bodies.",
        sub: "From newborns to teens, every step explained to you and to your child, alongside your pediatrician.",
        cta: "Book a Child Visit",
        ctaLink: JANE,
        fee: "Child or teen exam · 60 min · $99 · Infants: call for details",
        imageAlt: "Dr. Ashley Harper smiling down at a newborn in her arms",
        focus: "50% 22%",
    },
]

AudienceHero.defaultProps = {
    eyebrow: "Family Chiropractic · Woodstock, GA",
    audiences: DEFAULT_AUDIENCES,
    defaultIndex: 0,
    secondaryLabel: "Explore Our Care",
    secondaryLink: "/treatments",
    doctorName: "Dr. Ashley Harper",
    doctorRole: "Family Chiropractic",
    doctorCredentials: "Webster Certified · ICPA Trained",
    doctorLink: "/team/dr-ashley-harper",
    font: '"Geist", "Geist Variable", Inter, system-ui, sans-serif',
    headlineSize: 104,
    radius: 28,
    colors: {
        forest: "#264A49",
        cream: "#E4ECE7",
        chipIdle: "rgba(255,255,255,0.35)",
        overlay: "linear-gradient(180deg, rgba(27,44,48,0.10) 0%, rgba(27,44,48,0.20) 45%, rgba(27,44,48,0.62) 100%)",
    },
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
                line1: { type: ControlType.String, title: "Headline line 1" },
                line2: { type: ControlType.String, title: "Headline line 2" },
                sub: { type: ControlType.String, title: "Subline", displayTextArea: true },
                cta: { type: ControlType.String, title: "Button" },
                ctaLink: { type: ControlType.Link, title: "Button link" },
                fee: { type: ControlType.String, title: "Fee line" },
                image: { type: ControlType.ResponsiveImage, title: "Photo" },
                imageAlt: { type: ControlType.String, title: "Photo alt text" },
                focus: { type: ControlType.String, title: "Photo focus", description: "CSS position, e.g. 50% 25% keeps faces in frame" },
            },
        },
    },
    defaultIndex: { type: ControlType.Number, title: "Default chip", min: 0, max: 3, step: 1, description: "0 = first chip" },
    secondaryLabel: { type: ControlType.String, title: "2nd button" },
    secondaryLink: { type: ControlType.Link, title: "2nd button link" },
    doctorName: { type: ControlType.String, title: "Doctor name" },
    doctorRole: { type: ControlType.String, title: "Doctor role" },
    doctorCredentials: { type: ControlType.String, title: "Credentials" },
    doctorPhoto: { type: ControlType.ResponsiveImage, title: "Doctor photo" },
    doctorLink: { type: ControlType.Link, title: "Doctor link" },
    headlineSize: { type: ControlType.Number, title: "Headline max", min: 48, max: 140, step: 2, unit: "px" },
    radius: { type: ControlType.Number, title: "Corner radius", min: 0, max: 48, step: 1, unit: "px" },
    font: { type: ControlType.String, title: "Font family" },
    colors: {
        type: ControlType.Object,
        title: "Colors",
        controls: {
            forest: { type: ControlType.Color, title: "Forest" },
            cream: { type: ControlType.Color, title: "Arrow circle" },
            chipIdle: { type: ControlType.Color, title: "Chip border" },
            overlay: { type: ControlType.String, title: "Photo overlay (CSS)" },
        },
    },
})
