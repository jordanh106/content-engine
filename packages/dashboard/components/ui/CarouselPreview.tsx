import { useState } from "react";
import { Download, ChevronLeft, ChevronRight, X, Maximize2 } from "lucide-react";
import type { CarouselSlide } from "../../shared/types.js";

type CarouselPreviewProps = {
  slides: CarouselSlide[];
  platform: string;
  status: string;
};

export function CarouselPreview({ slides, platform, status }: CarouselPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!slides || slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-sm">
        {status === "generating" ? "Generating slides..." : "No slides available"}
      </div>
    );
  }

  const currentSlide = slides[currentIndex];

  const handlePrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));

  const handleDownload = async (slide: CarouselSlide) => {
    if (!slide.imagePath) return;
    const response = await fetch(slide.imagePath);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = slide.filename || `slide-${slide.slideIndex}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    for (const slide of slides) {
      await handleDownload(slide);
    }
  };

  const platformLabel =
    platform === "youtube_thumbnail"
      ? "YouTube Thumbnail"
      : platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
    <>
      {/* Main preview */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {platformLabel}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                status === "completed"
                  ? "bg-emerald-50 text-emerald-600"
                  : status === "generating"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-red-50 text-red-600"
              }`}
            >
              {status}
            </span>
          </div>
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 min-h-[44px] min-w-[44px] justify-center"
          >
            <Download size={14} />
            All
          </button>
        </div>

        {/* Slide viewer */}
        <div className="relative bg-slate-50">
          {currentSlide?.imagePath ? (
            <div className="relative group">
              <img
                src={currentSlide.imagePath}
                loading="lazy"
                alt={`Slide ${currentSlide.slideIndex + 1}`}
                className="w-full h-auto max-h-[400px] object-contain mx-auto"
              />
              <button
                onClick={() => setLightboxOpen(true)}
                className="absolute top-3 right-3 p-2 bg-black/40 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-300 text-sm">
              No image
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-slate-500 hover:text-slate-700 disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentIndex ? "bg-teal-600" : "bg-slate-300"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownload(currentSlide)}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-slate-500 hover:text-teal-600"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === slides.length - 1}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-slate-500 hover:text-slate-700 disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Slide info strip */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => setCurrentIndex(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                i === currentIndex
                  ? "bg-teal-50 text-teal-700 border border-teal-200"
                  : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {slide.slideType === "cover"
                ? "Cover"
                : slide.slideType === "cta"
                  ? "CTA"
                  : `Point ${slide.slideIndex}`}
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && currentSlide?.imagePath && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-3 text-white/70 hover:text-white"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={24} />
          </button>
          <img
            src={currentSlide.imagePath}
            loading="lazy"
            alt={`Slide ${currentSlide.slideIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
