'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { DiscussionFeed } from '@/components/DiscussionFeed';
import { ForumManager } from '@/components/ForumManager';
import { RightSidebar } from '@/components/RightSidebar';
import { FilterTabs } from '@/components/FilterTabs';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/Toast';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { ConfigExportImport } from '@/components/ConfigExportImport';
import { EmailPreferences } from '@/components/EmailPreferences';
import { OfflineBanner } from '@/components/OfflineBanner';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { CommandMenu } from '@/components/CommandMenu';
import { SkipLinks } from '@/components/SkipLinks';
import { AuthGate } from '@/components/AuthGate';
import { useForums } from '@/hooks/useForums';
import { useDiscussions } from '@/hooks/useDiscussions';
import { useAlerts } from '@/hooks/useAlerts';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useReadState } from '@/hooks/useReadState';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useTheme } from '@/hooks/useTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import { useStorageMonitor } from '@/hooks/useStorageMonitor';
import { StorageError } from '@/lib/storage';
import { ForumPreset } from '@/lib/forumPresets';
import { DiscussionTopic } from '@/types';
import { DiscussionReader } from '@/components/DiscussionReader';
import { DigestView } from '@/components/DigestView';
import { Bookmark as BookmarkIcon, ExternalLink, Trash2 } from 'lucide-react';

export default function AppPage() {
  const [activeView, setActiveView] = useState<'feed' | 'briefs' | 'projects' | 'saved' | 'settings'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'your'>('your');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileAlertsOpen, setIsMobileAlertsOpen] = useState(false);
  const [activeKeywordFilter, setActiveKeywordFilter] = useState<string | null>(null);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<DiscussionTopic | null>(null);

  const { forums, enabledForums, addForum, removeForum, toggleForum, importForums } = useForums();
  const { discussions, isLoading, error, lastUpdated, forumStates, refresh } = useDiscussions(enabledForums);
  const { alerts, addAlert, removeAlert, toggleAlert, importAlerts } = useAlerts();
  const { bookmarks, addBookmark, removeBookmark, isBookmarked, importBookmarks } = useBookmarks();
  const { isRead, markAsRead, markMultipleAsRead, getUnreadCount } = useReadState();
  const { shouldShowOnboarding, completeOnboarding, resetOnboarding } = useOnboarding();
  const { theme, toggleTheme } = useTheme();
  const { toasts, dismissToast, success, error: showError, warning } = useToast();

  const { quota, lastError: storageError } = useStorageMonitor(
    useCallback((error: StorageError) => {
      if (error.type === 'quota_exceeded') {
        showError(error.message);
      } else if (error.type === 'validation_error') {
        warning(error.message);
      } else if (error.type === 'parse_error') {
        showError(error.message);
      }
    }, [showError, warning])
  );

  const unreadCount = getUnreadCount(discussions.map((d) => d.refId));
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const isDark = theme === 'dark';

  const handleToggleBookmark = useCallback((topic: DiscussionTopic) => {
    if (isBookmarked(topic.refId)) {
      removeBookmark(topic.refId);
      success('Bookmark removed');
    } else {
      addBookmark(topic);
      success('Discussion saved to bookmarks');
    }
  }, [isBookmarked, removeBookmark, addBookmark, success]);

  const handleRemoveForum = useCallback((forumId: string) => {
    const forum = forums.find(f => f.id === forumId);
    removeForum(forumId);
    if (forum) {
      success(`${forum.name} removed from your forums`);
    }
  }, [forums, removeForum, success]);

  const handleMarkAllAsRead = useCallback((refIds: string[]) => {
    markMultipleAsRead(refIds);
    success(`Marked ${refIds.length} discussions as read`);
  }, [markMultipleAsRead, success]);

  const handleOnboardingComplete = useCallback((selectedForums: ForumPreset[]) => {
    selectedForums.forEach((preset) => {
      addForum({
        name: preset.name,
        cname: preset.name.toLowerCase().replace(/\s+/g, '-'),
        description: preset.description,
        logoUrl: preset.logoUrl,
        token: preset.token,
        sourceType: preset.sourceType,
        discourseForum: {
          url: preset.url,
          categoryId: preset.categoryId,
        },
        isEnabled: true,
      });
    });
    completeOnboarding();
    if (selectedForums.length > 0) {
      success(`Added ${selectedForums.length} forum${selectedForums.length !== 1 ? 's' : ''} to your feed`);
    }
  }, [addForum, completeOnboarding, success]);

  const handleOnboardingSkip = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  const handleConfigImport = useCallback((data: {
    forums?: import('@/types').Forum[];
    alerts?: import('@/types').KeywordAlert[];
    bookmarks?: import('@/types').Bookmark[];
  }) => {
    if (data.forums && data.forums.length > 0) {
      importForums(data.forums, false);
    }
    if (data.alerts && data.alerts.length > 0) {
      importAlerts(data.alerts, false);
    }
    if (data.bookmarks && data.bookmarks.length > 0) {
      importBookmarks(data.bookmarks, false);
    }
  }, [importForums, importAlerts, importBookmarks]);

  const handleSelectTopic = useCallback((topic: DiscussionTopic) => {
    setSelectedTopic(topic);
    if (!isRead(topic.refId)) {
      markAsRead(topic.refId);
    }
  }, [isRead, markAsRead]);

  const handleCloseReader = useCallback(() => {
    setSelectedTopic(null);
  }, []);

  useEffect(() => {
    if (error && !error.includes('All forums failed')) {
      warning(error);
    } else if (error) {
      showError(error);
    }
  }, [error, warning, showError]);

  useEffect(() => {
    if (enabledForums.length > 0 && discussions.length === 0 && !isLoading) {
      refresh();
    }
  }, [enabledForums.length, discussions.length, isLoading, refresh]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K for command menu (works even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandMenuOpen(prev => !prev);
        return;
      }

      // Skip other shortcuts when in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          if (window.innerWidth < 768) {
            setIsMobileAlertsOpen(true);
          }
          setTimeout(() => {
            const searchInput = document.getElementById('discussion-search') as HTMLInputElement;
            searchInput?.focus();
          }, 100);
          break;
        case 'Escape':
          if (selectedTopic) {
            setSelectedTopic(null);
          } else {
            setIsMobileMenuOpen(false);
            setIsMobileAlertsOpen(false);
            setIsCommandMenuOpen(false);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTopic]);

  return (
    <AuthGate>
      <ErrorBoundary>
        <SkipLinks />
        <OfflineBanner />
        <CommandMenu
          isOpen={isCommandMenuOpen}
          onClose={() => setIsCommandMenuOpen(false)}
          forums={enabledForums.map(f => ({ id: f.id, name: f.name, category: f.category || 'crypto' }))}
          onSelectForum={(forumId) => {
            setActiveView('feed');
            // The feed filters handle forum selection via FeedFilters component
            // Dispatch a custom event that FeedFilters can listen for
            window.dispatchEvent(new CustomEvent('selectForum', { detail: forumId }));
          }}
          onSelectCategory={(category) => {
            setActiveView('feed');
            window.dispatchEvent(new CustomEvent('selectCategory', { detail: category }));
          }}
          onSearch={(query) => {
            setActiveView('feed');
            setSearchQuery(query);
          }}
          onSort={(sort) => {
            window.dispatchEvent(new CustomEvent('selectSort', { detail: sort }));
          }}
          onAction={(action) => {
            switch (action) {
              case 'markAllRead':
                markMultipleAsRead(discussions.map(d => d.refId));
                success('All discussions marked as read');
                break;
              case 'refresh':
                refresh();
                break;
              case 'toggleTheme':
                toggleTheme();
                break;
            }
          }}
          isDark={isDark}
        />
        <div 
          className="flex h-screen overflow-hidden pt-14 md:pt-0"
          style={{ 
            backgroundColor: isDark ? '#000000' : '#fafafa',
            color: isDark ? '#ffffff' : '#18181b'
          }}
        >
          <Sidebar
            activeView={activeView}
            onViewChange={setActiveView}
            theme={theme}
            onToggleTheme={toggleTheme}
            savedCount={bookmarks.length}
            isMobileOpen={isMobileMenuOpen}
            onMobileToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header 
              className="flex items-center justify-between px-5 h-14 border-b flex-shrink-0"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
            >
              <FilterTabs
                filterMode={filterMode}
                onFilterChange={setFilterMode}
                totalCount={forums.length}
                enabledCount={enabledForums.length}
                isDark={isDark}
              />
            </header>

            <main id="main-content" className="flex-1 flex overflow-hidden">
              {activeView === 'feed' && (
                <>
                  <DiscussionFeed
                    discussions={discussions}
                    isLoading={isLoading}
                    error={error}
                    lastUpdated={lastUpdated}
                    onRefresh={refresh}
                    alerts={alerts}
                    searchQuery={debouncedSearchQuery}
                    enabledForumIds={enabledForums.map((f) => f.id)}
                    forumStates={forumStates}
                    forums={enabledForums}
                    isBookmarked={isBookmarked}
                    isRead={isRead}
                    onToggleBookmark={handleToggleBookmark}
                    onMarkAsRead={markAsRead}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    unreadCount={unreadCount}
                    onRemoveForum={handleRemoveForum}
                    activeKeywordFilter={activeKeywordFilter}
                    onSelectTopic={handleSelectTopic}
                    selectedTopicRefId={selectedTopic?.refId || null}
                    isDark={isDark}
                  />

                  {/* Desktop: Inline reader replaces RightSidebar */}
                  {selectedTopic ? (
                    <div className="hidden md:flex w-[480px] flex-shrink-0 relative">
                      {/* Clickable gutter to close reader */}
                      <button
                        onClick={handleCloseReader}
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-10 group"
                        title="Close reading pane"
                        aria-label="Close reading pane"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      />
                      <DiscussionReader
                        topic={selectedTopic}
                        onClose={handleCloseReader}
                        isDark={isDark}
                      />
                    </div>
                  ) : (
                    <RightSidebar
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      alerts={alerts}
                      onAddAlert={addAlert}
                      onRemoveAlert={removeAlert}
                      onToggleAlert={toggleAlert}
                      activeKeywordFilter={activeKeywordFilter}
                      onKeywordFilterChange={setActiveKeywordFilter}
                      isMobileOpen={isMobileAlertsOpen}
                      onMobileToggle={() => setIsMobileAlertsOpen(!isMobileAlertsOpen)}
                      isDark={isDark}
                    />
                  )}

                  {/* Mobile: Reader as full-screen overlay */}
                  {selectedTopic && (
                    <div className="md:hidden">
                      <DiscussionReader
                        topic={selectedTopic}
                        onClose={handleCloseReader}
                        isDark={isDark}
                        isMobile
                      />
                    </div>
                  )}
                </>
              )}

              {activeView === 'briefs' && (
                <>
                  <DigestView
                    onSelectTopic={handleSelectTopic}
                    isDark={isDark}
                  />
                  {/* Reader panel for briefs */}
                  {selectedTopic && (
                    <>
                      <div className="hidden md:flex w-[480px] flex-shrink-0 relative">
                        <button
                          onClick={handleCloseReader}
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-10"
                          title="Close reading pane"
                          aria-label="Close reading pane"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        />
                        <DiscussionReader
                          topic={selectedTopic}
                          onClose={handleCloseReader}
                          isDark={isDark}
                        />
                      </div>
                      <div className="md:hidden">
                        <DiscussionReader
                          topic={selectedTopic}
                          onClose={handleCloseReader}
                          isDark={isDark}
                          isMobile
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {activeView === 'projects' && (
                <div className="flex-1 overflow-y-auto">
                  <ForumManager
                    forums={forums}
                    onAddForum={addForum}
                    onRemoveForum={handleRemoveForum}
                    onToggleForum={toggleForum}
                    isDark={isDark}
                  />
                </div>
              )}

              {activeView === 'saved' && (
                <div className="flex-1 overflow-y-auto p-6">
                  <h2 
                    className="text-xl font-semibold mb-6 flex items-center gap-2"
                    style={{ color: isDark ? '#ffffff' : '#18181b' }}
                  >
                    <BookmarkIcon className="w-5 h-5" />
                    Saved Discussions
                  </h2>
                  {bookmarks.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-[13px] mb-1" style={{ color: isDark ? '#e5e5e5' : '#71717a' }}>
                        No saved discussions yet
                      </p>
                      <p className="text-[12px]" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
                        Click the bookmark icon on any discussion to save it
                      </p>
                    </div>
                  ) : (
                    <div>
                      {bookmarks.map((bookmark) => (
                        <div
                          key={bookmark.id}
                          className="group flex items-center justify-between py-3 border-b transition-colors"
                          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                        >
                          <div className="flex-1 min-w-0">
                            <a
                              href={bookmark.topicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[14px] font-medium line-clamp-1 transition-opacity hover:opacity-70"
                              style={{ color: isDark ? '#e4e4e7' : '#18181b' }}
                            >
                              {bookmark.topicTitle}
                            </a>
                            <p className="text-[12px] mt-0.5" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
                              {bookmark.protocol} · {new Date(bookmark.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={bookmark.topicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md"
                              style={{ color: isDark ? '#52525b' : '#a1a1aa' }}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => {
                                removeBookmark(bookmark.topicRefId);
                                success('Bookmark removed');
                              }}
                              className="p-1.5 rounded-md hover:text-red-500 transition-colors"
                              style={{ color: isDark ? '#52525b' : '#a1a1aa' }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeView === 'settings' && (
                <div className="flex-1 p-6 overflow-y-auto">
                  <h2 
                    className="text-[15px] font-semibold mb-6"
                    style={{ color: isDark ? '#e4e4e7' : '#18181b' }}
                  >
                    Settings
                  </h2>
                  <div className="max-w-2xl space-y-6">
                    <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                      <h3 className="text-[13px] font-medium mb-2" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>About</h3>
                      <p className="text-[13px]" style={{ color: isDark ? '#52525b' : '#6b7280' }}>
                        discuss.watch — Unified view of Discourse forums across crypto, AI, and open source communities.
                      </p>
                    </section>

                    <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                      <h3 className="text-[13px] font-medium mb-2" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>Data</h3>
                      <p className="text-[13px] mb-2" style={{ color: isDark ? '#52525b' : '#6b7280' }}>
                        All data stored locally in your browser.
                      </p>
                      {quota && (
                        <p className="text-[11px]" style={{ color: isDark ? '#3f3f46' : '#9ca3af' }}>
                          {(quota.used / 1024).toFixed(1)}KB used
                        </p>
                      )}
                    </section>

                    <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                      <h3 className="text-[13px] font-medium mb-3" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>Import / Export</h3>
                      <ConfigExportImport
                        forums={forums}
                        alerts={alerts}
                        bookmarks={bookmarks}
                        onImport={handleConfigImport}
                        isDark={isDark}
                      />
                    </section>

                    <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                      <h3 className="text-[13px] font-medium mb-3" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>Email Preferences</h3>
                      <EmailPreferences isDark={isDark} />
                    </section>

                    <section className="pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                      <h3 className="text-[13px] font-medium mb-3" style={{ color: isDark ? '#e5e5e5' : '#374151' }}>Keyboard Shortcuts</h3>
                      <KeyboardShortcuts isDark={isDark} />
                    </section>

                    <section>
                      <button
                        onClick={resetOnboarding}
                        className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
                        style={{ 
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          color: isDark ? '#e5e5e5' : '#374151'
                        }}
                      >
                        Show Onboarding
                      </button>
                    </section>
                  </div>
                </div>
              )}
            </main>
          </div>

          {shouldShowOnboarding && (
            <OnboardingWizard
              onComplete={handleOnboardingComplete}
              onSkip={handleOnboardingSkip}
            />
          )}

          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
      </ErrorBoundary>
    </AuthGate>
  );
}
