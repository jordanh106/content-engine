import React, { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOnboarding } from "../OnboardingProvider.js";
import { TOUR_STEPS } from "../../shared/help-content.js";
import { Spotlight } from "./Spotlight.js";

export const GuidedTour: React.FC = () => {
  const {
    isTourActive,
    currentTourStep,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    onNavigate,
  } = useOnboarding();

  const step = TOUR_STEPS[currentTourStep];
  const isLastStep = currentTourStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentTourStep === 0;

  // Navigate to the step's view if needed
  useEffect(() => {
    if (!isTourActive || !step?.view || !onNavigate) return;
    onNavigate(step.view);
  }, [isTourActive, currentTourStep, step?.view, onNavigate]);

  if (!isTourActive || !step) return null;

  const handleNext = () => {
    if (isLastStep) {
      completeTour();
    } else {
      nextStep();
    }
  };

  const popoverContent = (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl max-w-[320px] w-[320px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
        <button
          onClick={skipTour}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 -mt-1 -mr-1"
          aria-label="Skip tour"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <p className="text-xs text-slate-600 leading-relaxed mb-4">{step.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === currentTourStep
                  ? "bg-teal-600"
                  : i < currentTourStep
                    ? "bg-teal-300"
                    : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              onClick={prevStep}
              className="flex items-center gap-0.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ChevronLeft size={10} />
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex items-center gap-0.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white rounded-full bg-teal-600 hover:bg-teal-700 transition-colors"
          >
            {isLastStep ? "Finish" : "Next"}
            {!isLastStep && <ChevronRight size={10} />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Spotlight
      targetSelector={step.targetSelector}
      content={popoverContent}
      side={step.side || "bottom"}
      onDismiss={skipTour}
    />
  );
};
