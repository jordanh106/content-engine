"""
Blender headless carousel slide renderer.
Renders a complete 3D carousel slide with text overlays in a single pass.

Usage:
  blender --background --python render_carousel_slide.py -- \
    --heading "Your heading" \
    --body "Body text here" \
    --slide-type cover \
    --slide-index 0 \
    --total-slides 6 \
    --accent-object torus \
    --output /path/to/output.png \
    --width 1080 --height 1920

Requires Blender 5.0+.
"""

import bpy
import math
import sys
import argparse


# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------

def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    p = argparse.ArgumentParser(description="Render a carousel slide")
    p.add_argument("--heading", required=True)
    p.add_argument("--body", default="")
    p.add_argument("--slide-type", choices=["cover", "content", "cta"], default="cover")
    p.add_argument("--slide-index", type=int, default=0)
    p.add_argument("--total-slides", type=int, default=6)
    p.add_argument("--accent-object", choices=["torus", "sphere", "octahedron", "icosahedron", "none"], default="torus")
    p.add_argument("--output", required=True)
    p.add_argument("--width", type=int, default=1080)
    p.add_argument("--height", type=int, default=1920)
    p.add_argument("--primary-color", default="#0d9488")
    p.add_argument("--dark-bg", default="#1a1a2e")
    p.add_argument("--samples", type=int, default=64)
    return p.parse_args(argv)


def hex_to_rgb(hex_str):
    h = hex_str.lstrip("#")
    r, g, b = int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255
    def s2l(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (s2l(r), s2l(g), s2l(b), 1.0)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------

def make_metallic(name, color_hex, roughness=0.15, metallic=0.9):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = hex_to_rgb(color_hex)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metallic
    return mat


def make_emissive(name, color_hex, strength=2.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = hex_to_rgb(color_hex)
    em.inputs["Strength"].default_value = strength
    links.new(em.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_text_emissive(name, color_hex="#ffffff", strength=1.5):
    """Emissive material for text objects so they glow uniformly."""
    return make_emissive(name, color_hex, strength)


# ---------------------------------------------------------------------------
# Scene setup
# ---------------------------------------------------------------------------

def setup_render(args):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = args.output
    scene.render.film_transparent = False

    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = hex_to_rgb(args.dark_bg)
    bg.inputs["Strength"].default_value = 0.15


def setup_camera():
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 50
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 2.8
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (0, -7, 0.3)
    cam.rotation_euler = (math.radians(90), 0, 0)
    return cam


def setup_lighting(primary_color):
    # Key light
    key = bpy.data.lights.new(name="Key", type="AREA")
    key.energy = 600
    key.color = hex_to_rgb(primary_color)[:3]
    key.size = 3
    key_obj = bpy.data.objects.new("Key", key)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.location = (3, -4, 4)
    key_obj.rotation_euler = (math.radians(45), 0, math.radians(30))

    # Fill
    fill = bpy.data.lights.new(name="Fill", type="AREA")
    fill.energy = 250
    fill.color = (0.7, 0.8, 1.0)
    fill.size = 5
    fill_obj = bpy.data.objects.new("Fill", fill)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-4, -2, 2)
    fill_obj.rotation_euler = (math.radians(60), 0, math.radians(-45))

    # Rim
    rim = bpy.data.lights.new(name="Rim", type="POINT")
    rim.energy = 400
    rim.color = hex_to_rgb(primary_color)[:3]
    rim_obj = bpy.data.objects.new("Rim", rim)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (1, 4, -1)

    # Text illumination - broad soft light from camera direction
    text_light = bpy.data.lights.new(name="TextLight", type="AREA")
    text_light.energy = 150
    text_light.color = (1.0, 1.0, 1.0)
    text_light.size = 8
    text_obj = bpy.data.objects.new("TextLight", text_light)
    bpy.context.scene.collection.objects.link(text_obj)
    text_obj.location = (0, -6, 0)
    text_obj.rotation_euler = (math.radians(90), 0, 0)


# ---------------------------------------------------------------------------
# 3D objects
# ---------------------------------------------------------------------------

def add_accent_object(obj_type, primary_color):
    mat = make_metallic("AccentMetal", primary_color, roughness=0.12, metallic=0.95)
    loc = (2.0, 1.0, -0.2)
    rot = (math.radians(25), math.radians(15), 0)

    if obj_type == "torus":
        bpy.ops.mesh.primitive_torus_add(
            major_radius=1.1, minor_radius=0.38,
            major_segments=64, minor_segments=32,
            location=loc, rotation=rot,
        )
    elif obj_type == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.1, segments=64, ring_count=32, location=loc)
    elif obj_type == "octahedron":
        bpy.ops.mesh.primitive_ico_sphere_add(radius=1.1, subdivisions=1, location=loc)
        bpy.context.active_object.rotation_euler = rot
    elif obj_type == "icosahedron":
        bpy.ops.mesh.primitive_ico_sphere_add(radius=1.1, subdivisions=2, location=loc)
    elif obj_type == "none":
        return

    obj = bpy.context.active_object
    if obj:
        obj.name = "AccentObject"
        obj.data.materials.append(mat)
        for poly in obj.data.polygons:
            poly.use_smooth = True


def add_wireframe_accent(primary_color):
    bpy.ops.mesh.primitive_ico_sphere_add(
        radius=0.6, subdivisions=1,
        location=(-2.2, 0.8, 1.8),
        rotation=(math.radians(20), math.radians(30), 0),
    )
    obj = bpy.context.active_object
    obj.name = "WireAccent"

    mat = make_metallic("WireMat", primary_color, roughness=0.3, metallic=0.7)
    obj.data.materials.append(mat)

    mod = obj.modifiers.new(name="Wire", type="WIREFRAME")
    mod.thickness = 0.025
    mod.use_replace = True


def add_particles(primary_color, count=10):
    mat = make_emissive("ParticleGlow", primary_color, strength=8.0)
    for i in range(count):
        angle = (i / count) * math.pi * 2
        r = 2.8 + math.sin(i * 1.7) * 0.5
        y = math.sin(i * 0.8) * 2.0
        z = math.cos(i * 1.3) * 0.8 - 0.5
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=0.035, segments=8, ring_count=8,
            location=(math.cos(angle) * r, y, math.sin(angle) * r * 0.3 + z),
        )
        obj = bpy.context.active_object
        obj.name = f"P{i}"
        obj.data.materials.append(mat)


def add_ground(dark_bg):
    bpy.ops.mesh.primitive_plane_add(size=25, location=(0, 0, -2.8))
    obj = bpy.context.active_object
    obj.name = "Ground"
    mat = make_metallic("GroundMat", dark_bg, roughness=0.85, metallic=0.0)
    obj.data.materials.append(mat)


# ---------------------------------------------------------------------------
# Text overlays (rendered as 3D text in the scene)
# ---------------------------------------------------------------------------

def add_text(text, name, size, location, color_hex="#ffffff", align_x="LEFT", strength=1.5):
    """Add a flat text object facing the camera."""
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.body = text
    obj.data.size = size
    obj.data.align_x = align_x
    obj.data.align_y = "TOP"

    # Face the camera (rotate to face -Y direction)
    obj.rotation_euler = (math.radians(90), 0, 0)

    # Word wrap via text box
    obj.data.text_boxes[0].width = 4.5
    obj.data.text_boxes[0].height = 0

    mat = make_emissive(f"{name}_mat", color_hex, strength)
    obj.data.materials.append(mat)
    return obj


def add_accent_line(primary_color, location, width=0.7):
    """Thin glowing accent bar."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = "AccentLine"
    obj.scale = (width, 0.008, 1)
    obj.rotation_euler = (math.radians(90), 0, 0)
    mat = make_emissive("AccentLineMat", primary_color, strength=5.0)
    obj.data.materials.append(mat)


def build_text_overlays(args):
    """Position all text elements in 3D space, facing the camera."""
    is_cover = args.slide_type == "cover"
    is_cta = args.slide_type == "cta"

    # Bottom-aligned text layout (in world coordinates)
    # Camera looks from (0, -7, 0.3) toward origin
    # Text placed at y ~ -5 (close to camera) so it appears in front

    base_y = -5.5  # Close to camera = foreground
    text_z_start = -1.8  # Lower portion of frame

    # Accent line
    add_accent_line(args.primary_color, location=(-0.8, base_y, text_z_start + 0.15), width=0.6 if is_cover else 0.4)

    # Heading
    heading_size = 0.28 if is_cover else 0.24 if is_cta else 0.22
    heading = add_text(
        args.heading, "Heading", heading_size,
        (-2.2, base_y, text_z_start),
        "#ffffff", strength=2.0,
    )
    heading.data.text_boxes[0].width = 4.2

    # Body text
    if args.body:
        body = add_text(
            args.body, "Body", 0.14,
            (-2.1, base_y, text_z_start - 1.0),
            "#b0b0b8", strength=1.2,
        )
        body.data.text_boxes[0].width = 3.8

    # Slide counter (top right)
    counter = add_text(
        f"{args.slide_index + 1} / {args.total_slides}", "Counter", 0.08,
        (1.5, base_y, 2.8),
        "#6b7280", align_x="RIGHT", strength=0.8,
    )
    counter.data.text_boxes[0].width = 0  # No wrap

    # Badge
    if is_cover:
        badge = add_text("SWIPE >", "Badge", 0.08, (-2.2, base_y, 2.8), args.primary_color, strength=2.0)
        badge.data.text_boxes[0].width = 0
    elif is_cta:
        badge = add_text("TAKE ACTION", "Badge", 0.08, (-2.2, base_y, 2.8), "#f59e0b", strength=2.0)
        badge.data.text_boxes[0].width = 0

    # Brand mark
    brand = add_text(
        "COLLECTIVE FAMILY CHIROPRACTIC", "Brand", 0.06,
        (-2.2, base_y, -2.6),
        "#4b5563", strength=0.6,
    )
    brand.data.text_boxes[0].width = 0

    # Content slide number watermark
    if args.slide_type == "content":
        watermark = add_text(
            str(args.slide_index), "Watermark", 1.2,
            (1.0, base_y + 0.5, 0.5),
            args.primary_color, align_x="RIGHT", strength=0.15,
        )
        watermark.data.text_boxes[0].width = 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()
    print(f"[blender-carousel] Rendering: type={args.slide_type}, index={args.slide_index}, accent={args.accent_object}")

    clear_scene()
    setup_render(args)
    setup_camera()
    setup_lighting(args.primary_color)

    # 3D scene
    add_accent_object(args.accent_object, args.primary_color)
    if args.slide_type in ("cover", "cta"):
        add_wireframe_accent(args.primary_color)
    add_particles(args.primary_color)
    add_ground(args.dark_bg)

    # Text overlays (in-scene 3D text)
    build_text_overlays(args)

    # Render
    bpy.ops.render.render(write_still=True)
    print(f"[blender-carousel] Saved: {args.output}")


if __name__ == "__main__":
    main()
