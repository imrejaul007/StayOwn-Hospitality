'use client';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_NAMES = [
  'Hotel Info',
  'Room Setup',
  'Services',
  'Team',
  'Complete',
];

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <div key={step} className="flex items-center">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isCompleted
                      ? 'bg-blue-600 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={`text-xs mt-1 hidden sm:block ${
                    isCurrent ? 'text-blue-600 font-semibold' : isCompleted ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {STEP_NAMES[i]}
                </span>
              </div>

              {/* Connector Line */}
              {step < totalSteps && (
                <div
                  className={`w-12 sm:w-20 h-1 mx-2 rounded transition-all ${
                    isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Time Estimate */}
      <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>~{Math.ceil((totalSteps - currentStep + 1) * 0.8)} min left</span>
      </div>
    </div>
  );
}
