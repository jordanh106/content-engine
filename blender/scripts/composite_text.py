"""
Composite text overlay onto a Blender-rendered 3D background.

Uses Blender's built-in compositor to add text as image overlays.
This script generates text as SVG, renders to image, and composites.

For simplicity, we use a Python-only approach with basic Blender text objects
rendered as a separate pass, then composited.

Usage:
  blender --background --python composite_text.py -- \
    --bg-image /path/to/bg.png \
    --heading "Your heading" \
    --body "Body text" \
    --slide-type cover \
    --slide-index 0 \
    --total-slides 6 \
    --output /path/to/final.png \
    --width 1080 --height 1920
"""

import bpy
import math
import sys
import argparse
import os


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    p = argparse.ArgumentParser()
    p.add_argument("--bg-image", required=True)
    p.add_argument("--heading", required=True)
    p.add_argument("--body", default="")
    p.add_argument("--slide-type", default="cover")
    p.add_argument("--slide-index", type=int, default=0)
    p.add_argument("--total-slides", type=int, default=6)
    p.add_argument("--output", required=True)
    p.add_argument("--width", type=int, default=1080)
    p.add_argument("--height", type=int, default=1920)
    p.add_argument("--primary-color", default="#0d9488")
    return p.parse_args(argv)


def hex_to_rgb(h):
    h = h.lstrip("#")
    r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
    def s2l(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (s2l(r), s2l(g), s2l(b), 1.0)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def add_text_object(text, name, size, location, color_hex, bold=False, max_width=9.0):
    """Add a 3D text object positioned for orthographic camera overlay."""
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.body = text
    obj.data.size = size
    obj.data.align_x = "LEFT"
    obj.data.align_y = "TOP"

    # Text wrapping
    if max_width > 0:
        obj.data.text_boxes[0].width = max_width
        obj.data.text_boxes[0].height = 0  # Auto height

    # Font (use Blender's built-in; Georgia/custom fonts would need font files)
    # The built-in Bfont is clean and works for all slides
    if bold:
        # Blender doesn't have a separate bold built-in, so we use extrusion for emphasis
        obj.data.extrude = 0.01

    # Material
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = hex_to_rgb(color_hex)
    emission.inputs["Strength"].default_value = 1.0
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    obj.data.materials.append(mat)

    return obj


def main():
    args = parse_args()
    print(f"[composite] Compositing text onto {args.bg_image}")

    clear_scene()

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 4  # Low samples -- text only, no complex shading
    scene.cycles.use_denoising = False
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True  # Transparent background for compositing

    # Orthographic camera looking straight down at text plane
    cam_data = bpy.data.cameras.new("TextCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 10.0  # Controls visible area
    cam = bpy.data.objects.new("TextCam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = (0, 0, 5)
    cam.rotation_euler = (0, 0, 0)

    # Scale factor: ortho_scale maps to width. Height = ortho_scale * (height/width)
    aspect = args.height / args.width
    visible_height = cam_data.ortho_scale * aspect  # ~17.78 for 9:16
    half_w = cam_data.ortho_scale / 2  # 5.0
    half_h = visible_height / 2  # ~8.89

    # Padding from edges (in ortho units)
    pad_x = 0.55
    pad_bottom = 1.3
    text_x = -half_w + pad_x

    is_cover = args.slide_type == "cover"
    is_cta = args.slide_type == "cta"

    # Accent line
    bpy.ops.mesh.primitive_plane_add(
        size=1,
        location=(text_x + 0.35, -half_h + pad_bottom + 3.2, 0),
    )
    line = bpy.context.active_object
    line.name = "AccentLine"
    line.scale = (0.7 if is_cover else 0.45, 0.015, 1)
    line_mat = bpy.data.materials.new("AccentLineMat")
    line_mat.use_nodes = True
    nodes = line_mat.node_tree.nodes
    links = line_mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = hex_to_rgb(args.primary_color)
    em.inputs["Strength"].default_value = 3.0
    links.new(em.outputs["Emission"], out.inputs["Surface"])
    line.data.materials.append(line_mat)

    # Heading text
    heading_size = 0.48 if is_cover else 0.40 if is_cta else 0.36
    heading_y = -half_h + pad_bottom + 2.8
    add_text_object(
        args.heading, "Heading", heading_size,
        (text_x, heading_y, 0), "#ffffff", bold=True,
        max_width=cam_data.ortho_scale - pad_x * 2,
    )

    # Body text (in glass-panel-like area)
    if args.body:
        body_y = heading_y - 1.8
        add_text_object(
            args.body, "Body", 0.22,
            (text_x + 0.15, body_y, 0), "#d4d4d8", bold=False,
            max_width=cam_data.ortho_scale - pad_x * 2 - 0.3,
        )

    # Slide counter (top right)
    counter_text = f"{args.slide_index + 1} / {args.total_slides}"
    add_text_object(
        counter_text, "Counter", 0.14,
        (half_w - 1.2, half_h - 0.6, 0), "#6b7280", bold=False, max_width=0,
    )

    # Badge (SWIPE for cover, TAKE ACTION for CTA)
    if is_cover:
        add_text_object(
            "SWIPE >", "Badge", 0.12,
            (text_x, half_h - 0.6, 0), args.primary_color, bold=True, max_width=0,
        )
    elif is_cta:
        add_text_object(
            "TAKE ACTION", "Badge", 0.12,
            (text_x, half_h - 0.6, 0), "#f59e0b", bold=True, max_width=0,
        )

    # Brand mark (bottom left)
    add_text_object(
        "COLLECTIVE FAMILY CHIROPRACTIC", "BrandMark", 0.09,
        (text_x, -half_h + 0.5, 0), "#4b5563", bold=False, max_width=0,
    )

    # Render text layer to temp file
    text_layer_path = args.output.replace(".png", "_textlayer.png")
    scene.render.filepath = text_layer_path
    bpy.ops.render.render(write_still=True)

    # Now composite: bg image + text layer
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()

    # Nodes
    bg_node = tree.nodes.new("CompositorNodeImage")
    bg_img = bpy.data.images.load(args.bg_image)
    bg_node.image = bg_img

    text_node = tree.nodes.new("CompositorNodeImage")
    text_img = bpy.data.images.load(text_layer_path)
    text_node.image = text_img

    alpha_over = tree.nodes.new("CompositorNodeAlphaOver")
    output_node = tree.nodes.new("CompositorNodeComposite")

    # Link: bg -> alpha_over.Image, text -> alpha_over.Image (foreground)
    tree.links.new(bg_node.outputs["Image"], alpha_over.inputs[1])
    tree.links.new(text_node.outputs["Image"], alpha_over.inputs[2])
    tree.links.new(alpha_over.outputs["Image"], output_node.inputs["Image"])

    # Render composite
    scene.render.filepath = args.output
    bpy.ops.render.render(write_still=True)

    # Cleanup temp text layer
    try:
        os.remove(text_layer_path)
    except OSError:
        pass

    print(f"[composite] Final output: {args.output}")


if __name__ == "__main__":
    main()
