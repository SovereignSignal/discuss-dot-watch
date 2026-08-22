'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Bell, Bookmark, Search, Plus } from 'lucide-react';
import { FORUM_CATEGORIES, ForumPreset, getTotalForumCount } from '@/lib/forumPresets';
import { Button } from '@/components/ui/Button';
import { TickerBadge } from '@/components/ui/TickerBadge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { Vertical } from '@/components/ui/TickerBadge';

interface OnboardingWizardProps {
  onComplete: (selectedForums: ForumPreset[]) => void;
  onSkip: () => void;
}

const STEPS = [
  { title: 'Welcome to discuss.watch', description: 'Your unified feed for discussions across crypto, AI, and open source communities.' },
  { title: 'Select Communities', description: 'Choose the forums you want to follow. You can always add more later.' },
  { title: 'Quick Tips', description: "Here's how to get the most out of your feed:" },
];

function categoryVertical(id: string): Vertical {
  if (id === 'crypto' || id === 'ai' || id === 'oss') return id;
  return 'neutral';
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedForums, setSelectedForums] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState<string | null>('crypto');

  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const timer = setTimeout(() => firstFocusableRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      if (previouslyFocusedRef.current instanceof HTMLElement) previouslyFocusedRef.current.focus();
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled])');
      if (els.length === 0) return;
      if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const allForumsWithCategory = FORUM_CATEGORIES.flatMap((category) =>
    category.forums.filter((f) => f.tier === 1 || f.tier === 2).map((forum) => ({ ...forum, category: category.id }))
  );

  const handleToggleForum = useCallback((forumUrl: string) => {
    setSelectedForums((prev) => { const s = new Set(prev); if (s.has(forumUrl)) s.delete(forumUrl); else s.add(forumUrl); return s; });
  }, []);

  const returnFocus = useCallback(() => {
    if (previouslyFocusedRef.current instanceof HTMLElement) previouslyFocusedRef.current.focus();
  }, []);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) { setCurrentStep(currentStep + 1); } else {
      returnFocus();
      onComplete(allForumsWithCategory.filter((f) => selectedForums.has(f.url)));
    }
  };
  const handleBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };
  const handleSkip = useCallback(() => { returnFocus(); onSkip(); }, [onSkip, returnFocus]);

  const handleSelectPopular = () => {
    const popular = allForumsWithCategory.filter((f) => f.tier === 1).slice(0, 5).map((f) => f.url);
    setSelectedForums(new Set(popular));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--ds-bg-card)',
          border: '1px solid var(--ds-border)',
          borderRadius: 'var(--ds-radius-xl)',
          fontFamily: 'var(--ds-font-sans)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <button
          ref={firstFocusableRef}
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-md z-10"
          style={{ color: 'var(--ds-fg-muted)' }}
          aria-label="Skip onboarding"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center gap-2 pt-6 pb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-12 rounded-full"
              style={{ backgroundColor: i <= currentStep ? 'var(--ds-fg)' : 'var(--ds-border-subtle)' }}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-4">
          <SectionHeader meta={`${currentStep + 1} / ${STEPS.length}`}>Setup</SectionHeader>
          <h2
            id="onboarding-title"
            className="font-semibold tracking-tight mb-2"
            style={{ color: 'var(--ds-fg)', fontSize: 'var(--ds-text-xl)' }}
          >
            {STEPS[currentStep].title}
          </h2>
          <p className="mb-6" style={{ color: 'var(--ds-fg-muted)', fontSize: 'var(--ds-text-sm)' }}>
            {STEPS[currentStep].description}
          </p>

          {currentStep === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: <Bell className="w-5 h-5" />, title: 'Keyword Alerts', desc: 'Set up alerts for topics that matter to you' },
                { icon: <Bookmark className="w-5 h-5" />, title: 'Save Discussions', desc: 'Bookmark important discussions to revisit later' },
                { icon: <Search className="w-5 h-5" />, title: 'Search & Filter', desc: 'Find discussions by keyword, date, or forum' },
                { icon: <Plus className="w-5 h-5" />, title: 'Add Any Forum', desc: 'Add any Discourse-based governance forum' },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-4"
                  style={{
                    backgroundColor: 'var(--ds-bg-subtle)',
                    border: '1px solid var(--ds-border)',
                    borderRadius: 'var(--ds-radius-xl)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-md flex items-center justify-center mb-3"
                    style={{ backgroundColor: 'var(--ds-bg-elev)', color: 'var(--ds-fg-muted)' }}
                  >
                    {item.icon}
                  </div>
                  <h3 className="font-medium mb-1" style={{ color: 'var(--ds-fg)', fontSize: 'var(--ds-text-sm)' }}>{item.title}</h3>
                  <p style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-sm)' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-sm)' }}>
                  {selectedForums.size} forum{selectedForums.size !== 1 ? 's' : ''} selected
                </span>
                <Button variant="ghost" size="sm" onClick={handleSelectPopular}>
                  Select popular
                </Button>
              </div>
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                {FORUM_CATEGORIES.map((category) => {
                  const categoryForums = allForumsWithCategory.filter((f) => f.category === category.id);
                  if (categoryForums.length === 0) return null;
                  const isExpanded = expandedCategory === category.id;
                  const selectedInCategory = categoryForums.filter((f) => selectedForums.has(f.url)).length;
                  return (
                    <div
                      key={category.id}
                      className="overflow-hidden"
                      style={{ border: '1px solid var(--ds-border)', borderRadius: 'var(--ds-radius-lg)' }}
                    >
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                        className="w-full flex items-center justify-between p-3 text-left"
                        style={{ backgroundColor: 'var(--ds-bg-subtle)' }}
                        aria-expanded={isExpanded}
                      >
                        <TickerBadge vertical={categoryVertical(category.id)}>{category.name}</TickerBadge>
                        <span className="flex items-center gap-2" style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-xs)' }}>
                          {selectedInCategory > 0 && <span style={{ color: 'var(--ds-fg-muted)' }}>{selectedInCategory} selected</span>}
                          <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
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
                                className="w-full flex items-center gap-3 p-2 text-left"
                                style={{
                                  backgroundColor: isSelected ? 'var(--ds-bg-elev)' : 'transparent',
                                  border: `1px solid ${isSelected ? 'var(--ds-border-strong)' : 'transparent'}`,
                                  borderRadius: 'var(--ds-radius-md)',
                                }}
                                aria-pressed={isSelected}
                              >
                                <div
                                  className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
                                  style={{
                                    backgroundColor: isSelected ? 'var(--ds-fg)' : 'transparent',
                                    border: `1px solid ${isSelected ? 'var(--ds-fg)' : 'var(--ds-border-strong)'}`,
                                  }}
                                >
                                  {isSelected && <Check className="w-3 h-3" style={{ color: 'var(--ds-bg-base)' }} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span style={{ color: 'var(--ds-fg)', fontSize: 'var(--ds-text-sm)' }}>{forum.name}</span>
                                  {forum.token && (
                                    <span className="ml-2" style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-xs)', fontFamily: 'var(--ds-font-mono)' }}>
                                      ${forum.token}
                                    </span>
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

          {currentStep === 2 && (
            <div className="space-y-3">
              {[
                { n: '1', title: 'Set Up Keyword Alerts', desc: 'Use the "+ keyword" chip in the alerts strip above the feed. Discussions matching your keywords will be highlighted.' },
                { n: '2', title: 'Bookmark Important Discussions', desc: 'Click the bookmark icon on any discussion to save it. Access saved discussions from the "Saved" view.' },
                { n: '3', title: 'Add More Forums Anytime', desc: `Go to "Communities" in the sidebar to browse ${getTotalForumCount()} forums or add your own custom Discourse forum URL.` },
              ].map((tip) => (
                <div
                  key={tip.n}
                  className="p-4 flex gap-4"
                  style={{
                    backgroundColor: 'var(--ds-bg-subtle)',
                    border: '1px solid var(--ds-border)',
                    borderRadius: 'var(--ds-radius-xl)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ backgroundColor: 'var(--ds-fg)', color: 'var(--ds-bg-base)' }}
                  >
                    {tip.n}
                  </div>
                  <div>
                    <h3 className="font-medium mb-1" style={{ color: 'var(--ds-fg)', fontSize: 'var(--ds-text-sm)' }}>{tip.title}</h3>
                    <p style={{ color: 'var(--ds-fg-dim)', fontSize: 'var(--ds-text-sm)' }}>{tip.desc}</p>
                  </div>
                </div>
              ))}
              <div
                className="p-4"
                style={{
                  backgroundColor: 'var(--ds-bg-subtle)',
                  border: '1px solid var(--ds-border)',
                  borderRadius: 'var(--ds-radius-xl)',
                }}
              >
                <p style={{ color: 'var(--ds-fg-muted)', fontSize: 'var(--ds-text-sm)' }}>
                  {selectedForums.size > 0
                    ? <>You&apos;ve selected <strong style={{ color: 'var(--ds-fg)' }}>{selectedForums.size}</strong> forum{selectedForums.size !== 1 ? 's' : ''}. Click &quot;Get Started&quot; to load your feed!</>
                    : <>You haven&apos;t selected any forums yet. You can always add forums later from &quot;Communities&quot;.</>}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-8 py-4" style={{ borderTop: '1px solid var(--ds-border)' }}>
          <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0}>
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Button variant="primary" onClick={handleNext}>
            {currentStep === STEPS.length - 1 ? 'Get Started' : 'Next'}
            {currentStep < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
