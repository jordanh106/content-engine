# carousel-lab: Push Carousel to Canva

Fetches a saved carousel from the dashboard database and creates a Canva presentation using the Canva MCP. The resulting design URL is saved back to the database so the dashboard shows an "Open in Canva" link.

## Usage

```
/carousel-lab push [carousel-id]
```

To find a carousel ID: open the Carousel Lab view in the dashboard, click any carousel in the left panel — the ID is shown in the actions bar at the bottom.

Or run directly:
```bash
sqlite3 packages/dashboard/db.sqlite3 "SELECT id, idea_topic, platform, status FROM generated_carousels ORDER BY created_at DESC LIMIT 10"
```

## Workflow

### Step 1 — Read the carousel and its slides from SQLite

```bash
sqlite3 packages/dashboard/db.sqlite3 \
  "SELECT id, idea_topic, platform, hook_line, talking_points, cta_text, audience, hook_archetype \
   FROM generated_carousels WHERE id = [id]"

sqlite3 packages/dashboard/db.sqlite3 \
  "SELECT slide_index, slide_type, image_path, heading, body_text, visual_suggestion \
   FROM carousel_slides WHERE carousel_id = [id] ORDER BY slide_index"
```

### Step 2 — Build the presentation outline

For each slide, create an entry:
```
{
  title: heading (if set) OR infer from slide_type + talking point,
  description: body_text (if set) + " | Visual: " + visual_suggestion (if set)
}
```

If `heading` and `body_text` are null (slides haven't been edited yet), derive content from:
- Slide 0 (cover): use `hook_line`
- Middle slides (content/rehook): use items from `talking_points` (JSON array)
- Last slide (cta): use `cta_text`

### Step 3 — Get the brand kit

Call `mcp__claude_ai_Canva__list-brand-kits` to get the brand kit ID.
If multiple kits exist, prefer one with "Collective Family" in the name.

### Step 4 — Create the Canva design

Call `mcp__claude_ai_Canva__generate-design-structured` with:
```json
{
  "topic": "[carousel idea_topic or hook_line]",
  "audience": "[audience field, or 'general chiropractic audience' if null]",
  "style": "clean, bold typography, teal and slate color scheme, medical professional",
  "length": [slide count],
  "presentation_outlines": [array from Step 2],
  "brand_kit_id": "[id from Step 3, if available]"
}
```

### Step 5 — Save the Canva URL back to the database

```bash
sqlite3 packages/dashboard/db.sqlite3 \
  "UPDATE generated_carousels SET canva_design_id = '[design_id]', canva_design_url = '[design_url]' WHERE id = [id]"
```

If the `canva_design_id` or `canva_design_url` columns don't exist yet, run:
```bash
sqlite3 packages/dashboard/db.sqlite3 "ALTER TABLE generated_carousels ADD COLUMN canva_design_id TEXT"
sqlite3 packages/dashboard/db.sqlite3 "ALTER TABLE generated_carousels ADD COLUMN canva_design_url TEXT"
```

Alternatively, use the API endpoint (if dashboard server is running):
```bash
curl -X PUT http://localhost:3001/api/carousels/[id]/canva \
  -H "Content-Type: application/json" \
  -d '{"canvaDesignId": "[id]", "canvaDesignUrl": "[url]"}'
```

### Step 6 — Return result

Output:
```
✓ Canva design created for carousel [id]
  Title: [carousel topic]
  Slides: [count]
  URL: [canva design url]

The dashboard Carousel Lab will now show "Open in Canva →" next to this carousel.
Refresh the browser if the link doesn't appear immediately.
```

## Notes

- The Canva design is a presentation format. Download individual slides as PNG or export as PDF from Canva for platform upload.
- Instagram: download each slide as PNG at 1080×1350px (Portrait) or 1080×1080px (Square)
- LinkedIn: export as PDF — LinkedIn auto-converts to a swipeable carousel
- After downloading from Canva, update the carousel status in the dashboard to "completed"
