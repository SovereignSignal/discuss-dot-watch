'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Bell, Bookmark, Search, Plus } from 'lucide-react';
import { FORUM_CATEGORIES, ForumPreset } from '@/lib/forumPresets';

interface OnboardingWizardProps {
  onComplete: (selectedForums: ForumPreset[]) => void;
  onSkip: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Gov Watch',
    description: 'Your unified dashboard for governance discussions across DAOs and blockchain protocols.',
  },
  {
    title: 'Select Forums',
    description: 'Choose the governance forums you want to follow. You can always add more later.',
  },
  {
    title: 'Quick Tips',
    description: "Here's how to get the most out of Gov Watch:",
  },
];

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedForums, setSelectedForums] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState<string | null>('defi-lending');

  // Refs for focus management
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Store the previously focused element and set up focus trap
  useEffect(() => {
    // Store what was focused before the modal opened
    previouslyFocusedRef.current = document.activeElement;

    // Focus the first focusable element (skip button)
    const timer = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(timer);
      // Return focus to the previously focused element when modal closes
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, []);

  // Focus trap: keep focus within the modal
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Flatten all forums with category info for easy lookup
  const allForumsWithCategory = FORUM_CATEGORIES.flatMap((category) =>
    category.forums
      .filter((f) => f.tier === 1 || f.tier === 2)
      .map((forum) => ({ ...forum, category: category.id }))
  );

  const handleToggleForum = useCallback((forumUrl: string) => {
    setSelectedForums((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(forumUrl)) {
        newSet.delete(forumUrl);
      } else {
        newSet.add(forumUrl);
      }
      return newSet;
    });
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Finish onboarding - return focus before calling onComplete
      returnFocus();
      const selected = allForumsWithCategory.filter((f) =>
        selectedForums.has(f.url)
      );
      onComplete(selected);
    }
  };

  // Helper to return focus to the previously focused element
  const returnFocus = useCallback(() => {
    if (previouslyFocusedRef.current instanceof HTMLElement) {
      previouslyFocusedRef.current.focus();
    } else {
      // Fallback: focus the main content area
      const mainContent = document.getElementById('main-content');
      mainContent?.focus();
    }
  }, []);

  const handleSkip = useCallback(() => {
    returnFocus();
    onSkip();
  }, [onSkip, returnFocus]);

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSelectPopular = () => {
    // Select top 5 tier 1 forums
    const tier1Forums = allForumsWithCategory.filter((f) => f.tier === 1);
    const popular = tier1Forums.slice(0, 5).map((f) => f.url);
    setSelectedForums(new Set(popular));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-xl overflow-hidden"
        style={{ backgroundColor: 'var(--card-bg)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        {/* Close button */}
        <button
          ref={firstFocusableRef}
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 z-10"
          aria-label="Skip onboarding"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress indicators */}
        <div className="flex justify-center gap-2 pt-6 pb-4">
          {STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 w-12 rounded-full transition-colors ${
                index === currentStep
                  ? 'bg-indigo-500'
                  : index < currentStep
                    ? 'bg-indigo-700'
                    : 'bg-gray-700'
              }`}
              role="presentation"
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-4">
          <h2 id="onboarding-title" className="text-2xl font-bold text-white text-center mb-2">
            {STEPS[currentStep].title}
          </h2>
          <p className="text-gray-400 text-center mb-6">{STEPS[currentStep].description}</p>

          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center mb-3">
                    <Bell className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Keyword Alerts</h3>
                  <p className="text-gray-400 text-sm">
                    Set up alerts for topics that matter to you
                  </p>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center mb-3">
                    <Bookmark className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Save Discussions</h3>
                  <p className="text-gray-400 text-sm">
                    Bookmark important discussions to revisit later
                  </p>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center mb-3">
                    <Search className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Search & Filter</h3>
                  <p className="text-gray-400 text-sm">
                    Find discussions by keyword, date, or forum
                  </p>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center mb-3">
                    <Plus className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-white font-medium mb-1">Add Any Forum</h3>
                  <p className="text-gray-400 text-sm">
                    Add any Discourse-based governance forum
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Select Forums */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">
                  {selectedForums.size} forum{selectedForums.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={handleSelectPopular}
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Select popular
                </button>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                {FORUM_CATEGORIES.map((category) => {
                  const categoryForums = allForumsWithCategory.filter(
                    (f) => f.category === category.id
                  );
                  if (categoryForums.length === 0) return null;

                  const isExpanded = expandedCategory === category.id;
                  const selectedInCategory = categoryForums.filter((f) =>
                    selectedForums.has(f.url)
                  ).length;

                  return (
                    <div key={category.id} className="border border-gray-800 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                        className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                        aria-expanded={isExpanded}
                      >
                        <span className="text-white font-medium">{category.name}</span>
                        <span className="flex items-center gap-2 text-sm text-gray-400">
                          {selectedInCategory > 0 && (
                            <span className="text-indigo-400">{selectedInCategory} selected</span>
                          )}
                          <ChevronRight
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="p-2 space-y-1">
                          {categoryForums.map((forum) => {
                            const isSelected = selectedForums.has(forum.url);
                            return (
                              <button
                                key={forum.url}
                                onClick={() => handleToggleForum(forum.url)}
                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                  isSelected
                                    ? 'bg-indigo-900/30 border border-indigo-700'
                                    : 'hover:bg-gray-800 border border-transparent'
                                }`}
                                aria-pressed={isSelected}
                              >
                                <div
                                  className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${
                                    isSelected
                                      ? 'bg-indigo-600 border-indigo-600'
                                      : 'border-gray-600'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-white text-sm">{forum.name}</span>
                                  {forum.token && (
                                    <span className="ml-2 text-xs text-gray-500">${forum.token}</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Quick Tips */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-800 rounded-lg flex gap-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Set Up Keyword Alerts</h3>
                  <p className="text-gray-400 text-sm">
                    Use the right sidebar to add keywords. Discussions matching your keywords will be highlighted in yellow.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg flex gap-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Bookmark Important Discussions</h3>
                  <p className="text-gray-400 text-sm">
                    Click the bookmark icon on any discussion to save it. Access saved discussions from the &quot;Saved&quot; view in the sidebar.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg flex gap-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Add More Forums Anytime</h3>
                  <p className="text-gray-400 text-sm">
                    Go to &quot;Forums&quot; in the sidebar to browse 70+ pre-configured forums or add your own custom Discourse forum URL.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-green-900/20 border border-green-800 rounded-lg">
                <p className="text-green-400 text-sm">
                  {selectedForums.size > 0 ? (
                    <>
                      You&apos;ve selected <strong>{selectedForums.size}</strong> forum
                      {selectedForums.size !== 1 ? 's' : ''} to follow. Click &quot;Get Started&quot; to load your first discussions!
                    </>
                  ) : (
                    <>
                      You haven&apos;t selected any forums yet. You can always add forums later from the &quot;Forums&quot; section.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div
          className="flex justify-between items-center px-8 py-4 border-t"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            {currentStep === STEPS.length - 1 ? 'Get Started' : 'Next'}
            {currentStep < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
