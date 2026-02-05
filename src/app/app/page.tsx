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
import { Bookmark as BookmarkIcon, ExternalLink, Trash2 } from 'lucide-react';

export default function AppPage() {
  const [activeView, setActiveView] = useState<'feed' | 'projects' | 'saved' | 'settings'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'your'>('your');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileAlertsOpen, setIsMobileAlertsOpen] = useState(false);

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
          setIsMobileMenuOpen(false);
          setIsMobileAlertsOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AuthGate>
      <ErrorBoundary>
        <SkipLinks />
        <OfflineBanner />
        <div 
          className="flex h-screen overflow-hidden pt-14 md:pt-0"
          style={{ 
            backgroundColor: isDark ? '#09090b' : '#fafafa',
            color: isDark ? '#fafafa' : '#18181b'
          }}
        >
          {/* Ambient gradient background */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div 
              className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full blur-3xl"
              style={{ backgroundColor: isDark ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.12)' }}
            />
            <div 
              className="absolute top-1/3 -left-40 w-[400px] h-[400px] rounded-full blur-3xl"
              style={{ backgroundColor: isDark ? 'rgba(34, 211, 238, 0.05)' : 'rgba(34, 211, 238, 0.08)' }}
            />
            <div 
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-3xl"
              style={{ backgroundColor: isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.08)' }}
            />
          </div>

          <Sidebar
            activeView={activeView}
            onViewChange={setActiveView}
            theme={theme}
            onToggleTheme={toggleTheme}
            savedCount={bookmarks.length}
            isMobileOpen={isMobileMenuOpen}
            onMobileToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />

          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Header */}
            <header 
              className="flex items-center justify-between px-6 py-4 border-b backdrop-blur-xl"
              style={{ 
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                backgroundColor: isDark ? 'rgba(9, 9, 11, 0.8)' : 'rgba(250, 250, 250, 0.8)'
              }}
            >
              <FilterTabs
                filterMode={filterMode}
                onFilterChange={setFilterMode}
                totalCount={forums.length}
                enabledCount={enabledForums.length}
                isDark={isDark}
              />
            </header>

            <main id="main-content" className="flex-1 flex overflow-hidden relative">
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
                    isDark={isDark}
                  />
                  <RightSidebar
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    alerts={alerts}
                    onAddAlert={addAlert}
                    onRemoveAlert={removeAlert}
                    onToggleAlert={toggleAlert}
                    isMobileOpen={isMobileAlertsOpen}
                    onMobileToggle={() => setIsMobileAlertsOpen(!isMobileAlertsOpen)}
                    isDark={isDark}
                  />
                </>
              )}

              {activeView === 'projects' && (
                <div className="flex-1 overflow-y-auto">
                  <ForumManager
                    forums={forums}
                    onAddForum={addForum}
                    onRemoveForum={handleRemoveForum}
                    onToggleForum={toggleForum}
                  />
                </div>
              )}

              {activeView === 'saved' && (
                <div className="flex-1 overflow-y-auto p-6">
                  <h2 
                    className="text-xl font-semibold mb-6 flex items-center gap-2"
                    style={{ color: isDark ? '#fafafa' : '#18181b' }}
                  >
                    <BookmarkIcon className="w-5 h-5" />
                    Saved Discussions
                  </h2>
                  {bookmarks.length === 0 ? (
                    <div className="text-center py-12">
                      <BookmarkIcon 
                        className="w-12 h-12 mx-auto mb-4"
                        style={{ color: isDark ? '#52525b' : '#a1a1aa' }}
                      />
                      <p className="mb-2" style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>
                        No saved discussions yet
                      </p>
                      <p className="text-sm" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
                        Click the bookmark icon on any discussion to save it for later
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {bookmarks.map((bookmark) => (
                        <li
                          key={bookmark.id}
                          className="flex items-center justify-between p-4 rounded-2xl transition-all"
                          style={{ 
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)'
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <a
                              href={bookmark.topicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium line-clamp-1 hover:text-violet-500 transition-colors"
                              style={{ color: isDark ? '#fafafa' : '#18181b' }}
                            >
                              {bookmark.topicTitle}
                            </a>
                            <p className="text-sm mt-1" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>
                              {bookmark.protocol} · Saved {new Date(bookmark.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={bookmark.topicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2.5 rounded-xl transition-all"
                              style={{ 
                                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                color: isDark ? '#71717a' : '#a1a1aa'
                              }}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => {
                                removeBookmark(bookmark.topicRefId);
                                success('Bookmark removed');
                              }}
                              className="p-2.5 rounded-xl transition-all hover:text-rose-500"
                              style={{ 
                                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                color: isDark ? '#71717a' : '#a1a1aa'
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {activeView === 'settings' && (
                <div className="flex-1 p-6 overflow-y-auto">
                  <h2 
                    className="text-xl font-semibold mb-6"
                    style={{ color: isDark ? '#fafafa' : '#18181b' }}
                  >
                    Settings
                  </h2>
                  <div className="space-y-4 max-w-2xl">
                    <section 
                      className="p-5 rounded-2xl"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <h3 className="font-medium mb-2" style={{ color: isDark ? '#fafafa' : '#18181b' }}>About</h3>
                      <p className="text-sm" style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>
                        discuss.watch — A unified view of discussions from Discourse forums used by crypto, AI, and open source communities.
                      </p>
                    </section>
                    
                    <section 
                      className="p-5 rounded-2xl"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <h3 className="font-medium mb-2" style={{ color: isDark ? '#fafafa' : '#18181b' }}>Data Storage</h3>
                      <p className="text-sm mb-3" style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>
                        All forum configurations and alerts are stored locally in your browser. No data is sent to any external servers except for fetching discussions from the configured Discourse forums.
                      </p>
                      {quota && (
                        <div className="text-xs" style={{ color: isDark ? '#52525b' : '#a1a1aa' }}>
                          Storage: {(quota.used / 1024).toFixed(1)}KB used
                          {(quota as { total?: number }).total && ` of ${((quota as { total?: number }).total! / 1024 / 1024).toFixed(1)}MB`}
                        </div>
                      )}
                    </section>

                    <section 
                      className="p-5 rounded-2xl"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <h3 className="font-medium mb-3" style={{ color: isDark ? '#fafafa' : '#18181b' }}>Import / Export</h3>
                      <ConfigExportImport
                        forums={forums}
                        alerts={alerts}
                        bookmarks={bookmarks}
                        onImport={handleConfigImport}
                      />
                    </section>

                    <section 
                      className="p-5 rounded-2xl"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <h3 className="font-medium mb-3" style={{ color: isDark ? '#fafafa' : '#18181b' }}>Email Preferences</h3>
                      <EmailPreferences />
                    </section>

                    <section 
                      className="p-5 rounded-2xl"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <h3 className="font-medium mb-3" style={{ color: isDark ? '#fafafa' : '#18181b' }}>Keyboard Shortcuts</h3>
                      <KeyboardShortcuts />
                    </section>

                    <section 
                      className="p-5 rounded-2xl"
                      style={{ 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <h3 className="font-medium mb-3" style={{ color: isDark ? '#fafafa' : '#18181b' }}>Reset</h3>
                      <p className="text-sm mb-3" style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>
                        Show the onboarding wizard again to add more forums.
                      </p>
                      <button
                        onClick={resetOnboarding}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{ 
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          color: isDark ? '#a1a1aa' : '#71717a'
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
