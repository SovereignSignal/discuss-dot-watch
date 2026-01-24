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
import { OfflineBanner } from '@/components/OfflineBanner';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { SkipLinks } from '@/components/SkipLinks';
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
  const { shouldShowOnboarding, completeOnboarding } = useOnboarding();
  const { theme, toggleTheme } = useTheme();
  const { toasts, dismissToast, success, error: showError, warning } = useToast();

  // Storage monitoring with error notifications
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

  // Calculate unread count for currently displayed discussions
  const unreadCount = getUnreadCount(discussions.map((d) => d.refId));

  // Debounce search query to avoid filtering on every keystroke
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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
    // Add selected forums
    selectedForums.forEach((preset) => {
      addForum({
        name: preset.name,
        cname: preset.name.toLowerCase().replace(/\s+/g, '-'),
        description: preset.description,
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

  // Show toast when there are errors
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          // Open mobile alerts panel on mobile, focus search
          if (window.innerWidth < 768) {
            setIsMobileAlertsOpen(true);
          }
          // Focus search input after a short delay to allow panel to open
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
    <ErrorBoundary>
      <SkipLinks />
      <OfflineBanner />
      <div className="flex h-screen overflow-hidden theme-bg theme-text pt-14 md:pt-0">
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
          <header className="flex items-center justify-between p-4 border-b border-gray-800">
            <FilterTabs
              filterMode={filterMode}
              onFilterChange={setFilterMode}
              totalCount={forums.length}
              enabledCount={enabledForums.length}
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
                <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                  <BookmarkIcon className="w-5 h-5" aria-hidden="true" />
                  Saved Discussions
                </h2>
                {bookmarks.length === 0 ? (
                  <div className="text-center py-12">
                    <BookmarkIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" aria-hidden="true" />
                    <p className="text-gray-400 mb-2">No saved discussions yet</p>
                    <p className="text-gray-500 text-sm">
                      Click the bookmark icon on any discussion to save it for later
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2" role="list">
                    {bookmarks.map((bookmark) => (
                      <li
                        key={bookmark.id}
                        className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <a
                            href={bookmark.topicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white hover:text-red-400 font-medium line-clamp-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                          >
                            {bookmark.topicTitle}
                          </a>
                          <p className="text-sm text-gray-500 mt-1">
                            {bookmark.protocol} · Saved {new Date(bookmark.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={bookmark.topicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label={`Open ${bookmark.topicTitle}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => {
                              removeBookmark(bookmark.topicRefId);
                              success('Bookmark removed');
                            }}
                            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label={`Remove ${bookmark.topicTitle} from saved`}
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
              <div className="flex-1 p-6">
                <h2 className="text-xl font-semibold text-white mb-6">Settings</h2>
                <div className="space-y-4">
                  <section className="p-4 bg-gray-800 rounded-lg">
                    <h3 className="font-medium text-white mb-2">About</h3>
                    <p className="text-gray-400 text-sm">
                      Governance Forum Aggregator - A unified view of governance discussions from multiple
                      Discourse-based forums used by DAOs and blockchain protocols.
                    </p>
                  </section>
                  <section className="p-4 bg-gray-800 rounded-lg">
                    <h3 className="font-medium text-white mb-2">Data Storage</h3>
                    <p className="text-gray-400 text-sm mb-3">
                      All forum configurations and alerts are stored locally in your browser. No data is sent
                      to any external servers except for fetching discussions from the configured Discourse
                      forums.
                    </p>
                    {quota && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Storage used</span>
                          <span>{(quota.used / 1024).toFixed(1)} KB / {(quota.available / 1024 / 1024).toFixed(0)} MB</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${quota.isNearLimit ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(quota.percentUsed, 100)}%` }}
                            role="progressbar"
                            aria-valuenow={quota.percentUsed}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Storage ${quota.percentUsed.toFixed(1)}% used`}
                          />
                        </div>
                        {quota.isNearLimit && (
                          <p className="text-yellow-400 text-xs mt-2">
                            Storage is nearly full. Consider exporting your data and clearing old items.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                  <section className="p-4 bg-gray-800 rounded-lg">
                    <h3 className="font-medium text-white mb-2">Refresh Rate</h3>
                    <p className="text-gray-400 text-sm">
                      Discussions are cached and can be manually refreshed using the Refresh button. API
                      responses are cached for 2 minutes to reduce load on forum servers.
                    </p>
                  </section>
                  <section className="p-4 bg-gray-800 rounded-lg">
                    <h3 className="font-medium text-white mb-3">Export / Import</h3>
                    <ConfigExportImport
                      forums={forums}
                      alerts={alerts}
                      bookmarks={bookmarks}
                      onImport={handleConfigImport}
                    />
                  </section>
                  <section className="p-4 bg-gray-800 rounded-lg">
                    <KeyboardShortcuts />
                  </section>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Toast notifications */}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* Onboarding wizard for new users */}
        {shouldShowOnboarding && (
          <OnboardingWizard
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
