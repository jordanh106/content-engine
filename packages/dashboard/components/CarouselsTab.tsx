import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image, Plus, Trash2, Loader2, Box, Film } from "lucide-react";
import { CarouselPreview } from "./ui/CarouselPreview.js";
import type {
  GeneratedCarousel,
  CarouselPlatform,
  CarouselAspectRatio,
  CarouselStyle,
  CarouselOutputFormat,
  CAROUSEL_PLATFORM_CONFIGS,
} from "../shared/types.js";

type CarouselsTabProps = {
  code: string;
};

const PLATFORM_OPTIONS: { platform: CarouselPlatform; aspectRatio: CarouselAspectRatio; label: string }[] = [
  { platform: "instagram", aspectRatio: "1:1", label: "Instagram (Square)" },
  { platform: "instagram", aspectRatio: "4:5", label: "Instagram (Portrait)" },
  { platform: "linkedin", aspectRatio: "1:1", label: "LinkedIn" },
  { platform: "tiktok", aspectRatio: "9:16", label: "TikTok" },
  { platform: "youtube_thumbnail", aspectRatio: "16:9", label: "YouTube Thumbnail" },
];

export function CarouselsTab({ code }: CarouselsTabProps) {
  const queryClient = useQueryClient();
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<(typeof PLATFORM_OPTIONS)[number] | null>(null);
  const [carouselStyle, setCarouselStyle] = useState<CarouselStyle>("flat");
  const [outputFormat, setOutputFormat] = useState<CarouselOutputFormat>("static");

  // Fetch carousels for this video
  const { data: carousels = [], isLoading } = useQuery<GeneratedCarousel[]>({
    queryKey: ["carousels", code],
    queryFn: async () => {
      const res = await fetch(`/api/carousels?videoCode=${code}`);
      if (!res.ok) throw new Error("Failed to fetch carousels");
      return res.json();
    },
  });

  // Generate carousel from script
  const generateMutation = useMutation({
    mutationFn: async (opt: { platform: CarouselPlatform; aspectRatio: CarouselAspectRatio; carouselStyle: CarouselStyle; outputFormat: CarouselOutputFormat }) => {
      const res = await fetch(`/api/carousels/${code}/from-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: opt.platform, aspectRatio: opt.aspectRatio, carouselStyle: opt.carouselStyle, outputFormat: opt.outputFormat }),
      });
      if (!res.ok) throw new Error("Failed to generate carousel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carousels", code] });
      setShowGenerator(false);
      setSelectedPlatform(null);
    },
  });

  // Delete carousel
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/carousels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete carousel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carousels", code] });
    },
  });

  // Group carousels by platform
  const grouped = carousels.reduce(
    (acc, c) => {
      const key = c.platform === "youtube_thumbnail" ? "YouTube Thumbnails" : c.platform.charAt(0).toUpperCase() + c.platform.slice(1);
      if (!acc[key]) acc[key] = [];
      acc[key].push(c);
      return acc;
    },
    {} as Record<string, GeneratedCarousel[]>,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading carousels...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-700">Generated Carousels</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {carousels.length} carousel{carousels.length !== 1 ? "s" : ""} generated
          </p>
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors min-h-[44px]"
        >
          <Plus size={14} />
          Generate
        </button>
      </div>

      {/* Platform picker */}
      {showGenerator && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Select Platform
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PLATFORM_OPTIONS.map((opt) => (
              <button
                key={`${opt.platform}-${opt.aspectRatio}`}
                onClick={() => setSelectedPlatform(opt)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors border ${
                  selectedPlatform === opt
                    ? "bg-teal-50 border-teal-300 text-teal-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {selectedPlatform && (
            <>
              {/* Style selector */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Visual Style
                </p>
                <div className="flex gap-2">
                  {([
                    { value: "flat" as const, label: "Flat", desc: "AI-generated slides" },
                    { value: "remotion3d" as const, label: "3D", desc: "Three.js rendered" },
                    { value: "blender3d" as const, label: "Blender", desc: "Ray-traced 3D" },
                  ]).map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setCarouselStyle(s.value)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                        carouselStyle === s.value
                          ? "bg-teal-50 border-teal-300 text-teal-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {s.value === "remotion3d" && <Box size={14} />}
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Output format selector (only for 3D styles) */}
              {(carouselStyle === "remotion3d" || carouselStyle === "blender3d") && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Output Format
                  </p>
                  <div className="flex gap-2">
                    {([
                      { value: "static" as const, label: "Static Slides", desc: "PNG images" },
                      { value: "video" as const, label: "Video Carousel", desc: "Animated MP4" },
                    ]).map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setOutputFormat(f.value)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                          outputFormat === f.value
                            ? "bg-teal-50 border-teal-300 text-teal-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {f.value === "video" && <Film size={14} />}
                        <span>{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() =>
                  generateMutation.mutate({
                    platform: selectedPlatform.platform,
                    aspectRatio: selectedPlatform.aspectRatio,
                    carouselStyle,
                    outputFormat: (carouselStyle === "remotion3d" || carouselStyle === "blender3d") ? outputFormat : "static",
                  })
                }
                disabled={generateMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 min-h-[44px]"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    {carouselStyle !== "flat" ? <Box size={14} /> : <Image size={14} />}
                    Generate {carouselStyle === "remotion3d" ? "3D " : carouselStyle === "blender3d" ? "Blender " : ""}{selectedPlatform.label}
                    {outputFormat === "video" && carouselStyle !== "flat" ? " Video" : ""}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {carousels.length === 0 && !showGenerator && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Image size={32} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">No carousels generated yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Click "Generate" to create carousel slides from this video's script
          </p>
        </div>
      )}

      {/* Carousel groups */}
      {Object.entries(grouped).map(([platformLabel, items]) => (
        <div key={platformLabel} className="space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {platformLabel}
          </h4>
          {items.map((carousel) => (
            <div key={carousel.id} className="relative">
              {/* Style badge */}
              {carousel.carouselStyle === "remotion3d" && (
                <div className="absolute top-3 left-4 z-10">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-teal-100 text-teal-700 text-[9px] font-black uppercase tracking-wider">
                    <Box size={10} />
                    3D
                  </span>
                </div>
              )}
              {carousel.carouselStyle === "blender3d" && (
                <div className="absolute top-3 left-4 z-10">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-wider">
                    <Box size={10} />
                    BLENDER
                  </span>
                </div>
              )}
              {/* Video player for video carousels */}
              {carousel.outputFormat === "video" && carousel.videoPath ? (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {carousel.platform === "youtube_thumbnail" ? "YouTube Thumbnail" : carousel.platform.charAt(0).toUpperCase() + carousel.platform.slice(1)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 text-[9px] font-bold">
                        <Film size={10} />
                        VIDEO
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <video
                      src={carousel.videoPath}
                      controls
                      className="w-full rounded-xl"
                      style={{ maxHeight: 400 }}
                    />
                  </div>
                </div>
              ) : (
                <CarouselPreview
                  slides={carousel.slides || []}
                  platform={carousel.platform}
                  status={carousel.status}
                />
              )}
              <button
                onClick={() => {
                  if (confirm("Delete this carousel?")) {
                    deleteMutation.mutate(carousel.id);
                  }
                }}
                className="absolute top-3 right-14 p-2 text-slate-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
