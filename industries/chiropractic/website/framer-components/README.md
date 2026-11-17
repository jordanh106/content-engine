# CFC Framer Code Components

Three code components for the Collective Family Chiropractic site. They are styled to match the current Framer build (Geist, forest #264A49, #F7F7F7 background, white and frosted pill buttons) and add the ideas chosen from the redesign mockup.

- Live test page: https://claude.ai/artifact/QRrKcaW7EifqxsaCStXpBC
- Build brief: https://claude.ai/artifact/1S7eRtMHUKkz87fcZLXgcM

| File | What it does |
| --- | --- |
| `OfficeStatus.tsx` | Replaces "Closed now" with "Open now · until 1 PM", "Back at 3:30 PM" or "Opens Tue 9 AM", calculated in Woodstock's time zone and refreshed every minute. |
| `AudienceHero.tsx` | The current full-bleed home hero, where the Adults & Families / Pregnancy & Postpartum / Babies & Children chips crossfade the photo and swap the headline, subline, booking button and fee line. Replaces the 01 / 02 / 03 slider. |
| `StickyBookingBar.tsx` | Book + Call bar fixed to the bottom of the screen on phones, shown after the visitor scrolls past the hero. Follows the chip picked in the Audience Hero. |

## Installing in Framer

1. In Framer, open **Assets**, then **Code**, and click **+** to create a new code file. Name it after the component (for example `OfficeStatus`).
2. Replace the starter code with the full contents of the matching `.tsx` file and save.
3. Drag the component from **Assets › Code** onto the page. Its settings appear in the right panel.
4. Geist is already in the project; the components use it by default.

## Setting them up

**OfficeStatus**: put it in the header where "Closed now" is today, and on the Book page. Over the photo hero, set Text to white; on light sections keep the default #425C57. The default hours are the current office hours. To change them, edit the Hours field, one day per segment, 24-hour time, separated by `;`:

```
Tue 09:00-13:00, 15:30-18:00; Wed 09:00-13:00; Thu 09:00-13:00, 15:30-18:00; Fri 09:00-13:00, 15:30-18:00
```

**AudienceHero**: replace the home hero (keep the same 12 px page margin and 28 px corners). Give it a fixed height, for example 100vh minus 24 px. For each audience, upload the photo, set **Photo focus** so faces stay in frame (for example `50% 22%`), and set the button link to that audience's Jane appointment. Default chip is 0 (Adults & Families). The Pregnancy and Babies headlines are new copy for Dr. Ashley to approve.

**StickyBookingBar**: place it once on each page, or in a shared layout, at the top level of the page (not inside a stack or a frame with a transform, or it will not stay fixed). It shows on screens up to 809 px wide, after 400 px of scroll. On the Framer canvas it always shows so you can style it.

## Jane links

All buttons default to the general new-patient page: `https://thecollectivechiro.janeapp.com/#/new-patient-initial-exams`. For the best booking rate, open each appointment type in Jane (adult, prenatal, child or teen, family group) and paste its direct link into the matching audience.

## Checked

- Type-checked with TypeScript 5.6 in strict mode against React 18 and framer-motion 11 (with a stub for Framer's own `framer` module).
- `OfficeStatus` hours logic tested for 10 cases: before opening, open, lunch break, after close, Wednesday half day, Friday evening and the weekend.
- Not yet run inside Framer itself. Check each one on the canvas and in Preview after pasting it in.
