"""
Blender headless 3D background renderer for carousel slides.
Renders ONLY the 3D scene (no text). Text is composited separately via FFmpeg.

Usage:
  blender --background --python render_bg.py -- \
    --accent-object torus \
    --slide-type cover \
    --output /path/to/bg.png \
    --width 1080 --height 1920 \
    --primary-color "#0d9488" \
    --dark-bg "#1a1a2e" \
    --samples 64
"""

import bpy
import math
import sys
import argparse


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument("--accent-object", choices=["torus", "sphere", "octahedron", "icosahedron", "none"], default="torus")
    p.add_argument("--slide-type", choices=["cover", "content", "cta"], default="cover")
    p.add_argument("--output", required=True)
    p.add_argument("--width", type=int, default=1080)
    p.add_argument("--height", type=int, default=1920)
    p.add_argument("--primary-color", default="#0d9488")
    p.add_argument("--dark-bg", default="#1a1a2e")
    p.add_argument("--samples", type=int, default=64)
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
    scene.render.image_settings.color_mode = "RGB"
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


def setup_lighting(pc):
    key = bpy.data.lights.new("Key", "AREA")
    key.energy = 600
    key.color = hex_to_rgb(pc)[:3]
    key.size = 3
    ko = bpy.data.objects.new("Key", key)
    bpy.context.scene.collection.objects.link(ko)
    ko.location = (3, -4, 4)
    ko.rotation_euler = (math.radians(45), 0, math.radians(30))

    fill = bpy.data.lights.new("Fill", "AREA")
    fill.energy = 250
    fill.color = (0.7, 0.8, 1.0)
    fill.size = 5
    fo = bpy.data.objects.new("Fill", fill)
    bpy.context.scene.collection.objects.link(fo)
    fo.location = (-4, -2, 2)
    fo.rotation_euler = (math.radians(60), 0, math.radians(-45))

    rim = bpy.data.lights.new("Rim", "POINT")
    rim.energy = 400
    rim.color = hex_to_rgb(pc)[:3]
    ro = bpy.data.objects.new("Rim", rim)
    bpy.context.scene.collection.objects.link(ro)
    ro.location = (1, 4, -1)


def add_accent(obj_type, pc):
    mat = make_metallic("Accent", pc, 0.12, 0.95)
    loc = (2.0, 1.0, -0.2)
    rot = (math.radians(25), math.radians(15), 0)

    if obj_type == "torus":
        bpy.ops.mesh.primitive_torus_add(major_radius=1.1, minor_radius=0.38, major_segments=64, minor_segments=32, location=loc, rotation=rot)
    elif obj_type == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1.1, segments=64, ring_count=32, location=loc)
    elif obj_type == "octahedron":
        bpy.ops.mesh.primitive_ico_sphere_add(radius=1.1, subdivisions=1, location=loc)
        bpy.context.active_object.rotation_euler = rot
    elif obj_type == "icosahedron":
        bpy.ops.mesh.primitive_ico_sphere_add(radius=1.1, subdivisions=2, location=loc)
    else:
        return

    obj = bpy.context.active_object
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = True


def add_wireframe(pc):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=0.6, subdivisions=1, location=(-2.2, 0.8, 1.8), rotation=(0.35, 0.52, 0))
    obj = bpy.context.active_object
    obj.data.materials.append(make_metallic("Wire", pc, 0.3, 0.7))
    mod = obj.modifiers.new("Wire", "WIREFRAME")
    mod.thickness = 0.025
    mod.use_replace = True


def add_particles(pc, n=10):
    mat = make_emissive("Glow", pc, 8.0)
    for i in range(n):
        a = (i / n) * math.pi * 2
        r = 2.8 + math.sin(i * 1.7) * 0.5
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, segments=8, ring_count=8,
            location=(math.cos(a) * r, math.sin(i * 0.8) * 2, math.cos(i * 1.3) * 0.8 + math.sin(a) * r * 0.3 - 0.5))
        bpy.context.active_object.data.materials.append(mat)


def add_ground(bg):
    bpy.ops.mesh.primitive_plane_add(size=25, location=(0, 0, -2.8))
    bpy.context.active_object.data.materials.append(make_metallic("Ground", bg, 0.85, 0.0))


def main():
    args = parse_args()
    print(f"[blender-bg] Rendering 3D background: accent={args.accent_object}, type={args.slide_type}")
    clear_scene()
    setup_render(args)
    setup_camera()
    setup_lighting(args.primary_color)
    add_accent(args.accent_object, args.primary_color)
    if args.slide_type in ("cover", "cta"):
        add_wireframe(args.primary_color)
    add_particles(args.primary_color)
    add_ground(args.dark_bg)
    bpy.ops.render.render(write_still=True)
    print(f"[blender-bg] Saved: {args.output}")


if __name__ == "__main__":
    main()
