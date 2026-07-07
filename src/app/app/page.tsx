'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { DiscussionFeed } from '@/components/DiscussionFeed';
import { ForumManager } from '@/components/ForumManager';
import { FilterTabs } from '@/components/FilterTabs';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastContainer } from '@/components/Toast';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { OfflineBanner } from '@/components/OfflineBanner';
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
import { useDensity } from '@/hooks/useDensity';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/useToast';
import { useStorageMonitor } from '@/hooks/useStorageMonitor';
import { StorageError } from '@/lib/storage';
import { ForumPreset, getTotalForumCount, FORUM_CATEGORIES } from '@/lib/forumPresets';
import { DiscussionTopic, SortOption } from '@/types';
import { useAllDiscussions } from '@/hooks/useAllDiscussions';
import { useFeedFilters, normalizeForumUrl } from '@/hooks/useFeedFilters';
import { c } from '@/lib/theme';
import { DiscussionReader } from '@/components/DiscussionReader';
import { DigestView } from '@/components/DigestView';
import { SavedView } from '@/components/SavedView';
import { SettingsView } from '@/components/SettingsView';

// Discourse presets only: /api/discussions can't filter by external-source
// URLs (their cache keys are source ids), so offering them in the server-mode
// dropdown — or forwarding them from a Your-mode selection — yields an
// inexplicably empty feed.
const ALL_FORUMS_LIST = FORUM_CATEGORIES.flatMap(cat =>
  cat.forums
    .filter(f => !f.sourceType || f.sourceType === 'discourse')
    .map(f => ({
      value: f.url.replace(/\/$/, '').toLowerCase(),
      label: f.name,
      category: cat.id,
    }))
).sort((a, b) => a.label.localeCompare(b.label));

const SERVER_FORUM_URLS = new Set(ALL_FORUMS_LIST.map(f => f.value));

export default function AppPage() {
  const [activeView, setActiveView] = useState<'feed' | 'briefs' | 'projects' | 'saved' | 'settings'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'your'>('your');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeKeywordFilter, setActiveKeywordFilter] = useState<string | null>(null);
  // '/' may be pressed from any view; the search input only exists once the
  // feed view has mounted, so focus happens in an effect after that render.
  const [pendingSearchFocus, setPendingSearchFocus] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<DiscussionTopic | null>(null);
  // The refId of a topic that was UNREAD when opened — exempt from the feed's
  // read-collapse while its reader is open. Lives here (not in the feed) so
  // every selection path shares it: row clicks, BriefsStrip, and j/k.
  const [freshlyReadRefId, setFreshlyReadRefId] = useState<string | null>(null);

  const { forums, enabledForums, addForum, removeForum, toggleForum, importForums } = useForums();
  const { discussions, isLoading, error, lastUpdated, forumStates, refresh } = useDiscussions(enabledForums);
  const enabledForumUrls = useMemo(
    () => enabledForums.map(f => f.discourseForum.url.replace(/\/$/, '')),
    [enabledForums]
  );
  const { alerts, enabledAlerts, addAlert, removeAlert, toggleAlert, importAlerts } = useAlerts();
  const { bookmarks, addBookmark, removeBookmark, setBookmarkFolder, isBookmarked, importBookmarks } = useBookmarks();
  const { isRead, markAsRead, markMultipleAsRead, getUnreadCount } = useReadState();
  const { shouldShowOnboarding, completeOnboarding, resetOnboarding } = useOnboarding();
  const { theme, toggleTheme } = useTheme();
  const { density, setDensity } = useDensity();
  const { toasts, dismissToast, success, error: showError, warning } = useToast();

  const { quota } = useStorageMonitor(
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
  const t = c(isDark);

  // Feed filters live here (not inside DiscussionFeed) so they survive the
  // Your/All toggle and view switches, and so the command menu can set them
  // directly instead of via fragile CustomEvents.
  const feedFilters = useFeedFilters();

  // --- "All Forums" server-side mode ---
  const allDiscussionsFilters = useMemo(() => ({
    searchQuery: debouncedSearchQuery,
    category: feedFilters.selectedCategory,
    dateRange: feedFilters.dateRange,
    dateMode: feedFilters.dateFilterMode,
    sort: feedFilters.sortBy,
    keyword: activeKeywordFilter === 'all' ? null : activeKeywordFilter,
    // Only forward URLs the server can actually match (Discourse presets);
    // an external-source or custom-forum selection carried over from Your
    // mode would otherwise filter everything out.
    forum: feedFilters.selectedForum && SERVER_FORUM_URLS.has(feedFilters.selectedForum)
      ? feedFilters.selectedForum
      : null,
  }), [debouncedSearchQuery, feedFilters.selectedCategory, feedFilters.dateRange, feedFilters.dateFilterMode, feedFilters.sortBy, feedFilters.selectedForum, activeKeywordFilter]);

  const {
    discussions: allDiscussions,
    isLoading: allIsLoading,
    meta: allMeta,
    error: allError,
    loadMore: allLoadMore,
    refresh: allRefresh,
    hasMore: allHasMore,
  } = useAllDiscussions(filterMode === 'all', allDiscussionsFilters, enabledForumUrls);

  const allForumsList = ALL_FORUMS_LIST;
  const allUnreadCount = getUnreadCount(allDiscussions.map((d) => d.refId));

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
    setFreshlyReadRefId(isRead(topic.refId) ? null : topic.refId);
    if (!isRead(topic.refId)) {
      markAsRead(topic.refId);
    }
    if (topic.sourceType && topic.sourceType !== 'discourse' && topic.externalUrl) {
      window.open(topic.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setSelectedTopic(topic);
  }, [isRead, markAsRead]);

  const handleCloseReader = useCallback(() => {
    setSelectedTopic(null);
  }, []);

  // The feed reports its currently visible, ordered topics so j/k can
  // navigate the same list the user sees.
  const visibleTopicsRef = useRef<DiscussionTopic[]>([]);
  const handleVisibleTopicsChange = useCallback((topics: DiscussionTopic[]) => {
    visibleTopicsRef.current = topics;
  }, []);

  const navigateReader = useCallback((dir: 1 | -1) => {
    const list = visibleTopicsRef.current;
    if (list.length === 0) return;
    // Skip external rows — selecting one opens a browser tab per keypress.
    const opensInReader = (t: DiscussionTopic) => !(t.sourceType && t.sourceType !== 'discourse' && t.externalUrl);
    const currentRef = selectedTopic?.refId;
    let idx = currentRef ? list.findIndex(topic => topic.refId === currentRef) : -1;
    if (idx === -1 && dir === -1) idx = list.length;
    for (let i = idx + dir; i >= 0 && i < list.length; i += dir) {
      if (opensInReader(list[i])) {
        handleSelectTopic(list[i]);
        return;
      }
    }
  }, [selectedTopic, handleSelectTopic]);

  useEffect(() => {
    if (error && !error.includes('All forums failed')) {
      warning(error);
    } else if (error) {
      showError(error);
    }
  }, [error, warning, showError]);

  useEffect(() => {
    if (allError) showError(allError);
  }, [allError, showError]);

  const hasAttemptedFetch = useRef(false);
  useEffect(() => {
    if (enabledForums.length > 0 && discussions.length === 0 && !isLoading && !hasAttemptedFetch.current) {
      hasAttemptedFetch.current = true;
      refresh();
    }
    // Reset when forums change so a new set of forums triggers a fresh fetch
    if (enabledForums.length === 0) {
      hasAttemptedFetch.current = false;
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

      // Skip other shortcuts when in form fields or editable content
      // (select type-to-jump would otherwise drive j/k navigation).
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key) {
        case '/':
          e.preventDefault();
          setActiveView('feed');
          setPendingSearchFocus(true);
          break;
        case 'j':
          if (activeView === 'feed') navigateReader(1);
          break;
        case 'k':
          if (activeView === 'feed') navigateReader(-1);
          break;
        // Triage keys — act on the topic open in the reader.
        case 's':
          if (activeView === 'feed' && selectedTopic) handleToggleBookmark(selectedTopic);
          break;
        case 'o':
          if (activeView === 'feed' && selectedTopic) {
            const url = selectedTopic.externalUrl || `${selectedTopic.forumUrl}/t/${selectedTopic.slug}/${selectedTopic.id}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }
          break;
        case 'e':
          // "Done with this one": drop the read-collapse exemption so the row
          // files away immediately, and close the reader.
          if (activeView === 'feed' && selectedTopic) {
            setFreshlyReadRefId(null);
            setSelectedTopic(null);
          }
          break;
        case 'Escape':
          if (selectedTopic) {
            setSelectedTopic(null);
          } else {
            setIsMobileMenuOpen(false);
            setIsCommandMenuOpen(false);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedTopic, activeView, navigateReader, handleToggleBookmark]);

  // Runs after the commit that mounts the feed, so the input exists by now.
  useEffect(() => {
    if (!pendingSearchFocus) return;
    if (activeView === 'feed') {
      (document.getElementById('discussion-search') as HTMLInputElement | null)?.focus();
    }
    setPendingSearchFocus(false);
  }, [pendingSearchFocus, activeView]);

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
            // Direct setter (the old CustomEvent was lost whenever the feed
            // wasn't mounted, and carried an id the server mode couldn't use).
            const forum = enabledForums.find(f => f.id === forumId);
            if (forum) feedFilters.setSelectedForum(normalizeForumUrl(forum.discourseForum.url));
          }}
          onSelectCategory={(category) => {
            setActiveView('feed');
            feedFilters.setSelectedCategory(category);
            feedFilters.setSelectedForum(null);
          }}
          onSearch={(query) => {
            setActiveView('feed');
            setSearchQuery(query);
          }}
          onSort={(sort) => {
            feedFilters.setSortBy(sort as SortOption);
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
          style={{ backgroundColor: 'var(--ds-bg-base)', color: 'var(--ds-fg)' }}
        >
          <Sidebar
            activeView={activeView}
            onViewChange={setActiveView}
            theme={theme}
            onToggleTheme={toggleTheme}
            density={density}
            onSetDensity={setDensity}
            savedCount={bookmarks.length}
            isMobileOpen={isMobileMenuOpen}
            onMobileToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header 
              className="flex items-center justify-between px-5 h-14 border-b flex-shrink-0"
              style={{ borderColor: t.borderSubtle }}
            >
              <FilterTabs
                filterMode={filterMode}
                onFilterChange={setFilterMode}
                totalCount={Math.max(forums.length, getTotalForumCount())}
                enabledCount={enabledForums.length}
                isDark={isDark}
              />
            </header>

            <main id="main-content" className="flex-1 flex overflow-hidden">
              {activeView === 'feed' && (
                <>
                  {filterMode === 'all' ? (
                    <DiscussionFeed
                      discussions={allDiscussions}
                      isLoading={allIsLoading}
                      lastUpdated={null}
                      onRefresh={allRefresh}
                      alerts={alerts}
                      searchQuery={debouncedSearchQuery}
                      searchInputValue={searchQuery}
                      enabledForumIds={[]}
                      forumStates={[]}
                      forums={enabledForums}
                      isBookmarked={isBookmarked}
                      isRead={isRead}
                      onToggleBookmark={handleToggleBookmark}
                      onMarkAsRead={markAsRead}
                      onMarkAllAsRead={handleMarkAllAsRead}
                      unreadCount={allUnreadCount}
                      activeKeywordFilter={activeKeywordFilter}
                      onSelectTopic={handleSelectTopic}
                      onTagClick={setSearchQuery}
                      onSearchInputChange={setSearchQuery}
                      onAddAlert={addAlert}
                      onRemoveAlert={removeAlert}
                      onToggleAlert={toggleAlert}
                      onKeywordFilterChange={setActiveKeywordFilter}
                      selectedTopicRefId={selectedTopic?.refId || null}
                      isDark={isDark}
                      feedFilters={feedFilters}
                      freshlyReadRefId={freshlyReadRefId}
                      onVisibleTopicsChange={handleVisibleTopicsChange}
                      onSeeAllBriefs={() => setActiveView('briefs')}
                      serverMode
                      serverTotal={allMeta?.total ?? 0}
                      serverHasMore={allHasMore}
                      onLoadMore={allLoadMore}
                      cachedForumCount={allMeta?.cachedForumCount}
                      allForumsList={allForumsList}
                    />
                  ) : (
                    <DiscussionFeed
                      discussions={discussions}
                      isLoading={isLoading}
                      lastUpdated={lastUpdated}
                      onRefresh={refresh}
                      alerts={alerts}
                      searchQuery={debouncedSearchQuery}
                      searchInputValue={searchQuery}
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
                      onTagClick={setSearchQuery}
                      onSearchInputChange={setSearchQuery}
                      onAddAlert={addAlert}
                      onRemoveAlert={removeAlert}
                      onToggleAlert={toggleAlert}
                      onKeywordFilterChange={setActiveKeywordFilter}
                      selectedTopicRefId={selectedTopic?.refId || null}
                      isDark={isDark}
                      feedFilters={feedFilters}
                      freshlyReadRefId={freshlyReadRefId}
                      onVisibleTopicsChange={handleVisibleTopicsChange}
                      onSeeAllBriefs={() => setActiveView('briefs')}
                    />
                  )}

                  {/* Desktop: Inline reader takes the reclaimed right pane when reading.
                      When no topic is selected, the right sidebar is hidden — search and
                      alerts have moved into the feed header and AlertsStrip in Sprint 16. */}
                  {selectedTopic && (
                    <div className="hidden md:flex w-[480px] flex-shrink-0 relative">
                      {/* Clickable gutter to close reader */}
                      <button
                        onClick={handleCloseReader}
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize z-10 group"
                        title="Close reading pane"
                        aria-label="Close reading pane"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.bgActiveStrong}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      />
                      <DiscussionReader
                        topic={selectedTopic}
                        onClose={handleCloseReader}
                        isDark={isDark}
                      />
                    </div>
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
                    forumUrls={enabledForumUrls}
                    enabledAlerts={enabledAlerts}
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
                <SavedView
                  bookmarks={bookmarks}
                  onRemoveBookmark={(topicRefId) => {
                    removeBookmark(topicRefId);
                    success('Bookmark removed');
                  }}
                  onSetFolder={setBookmarkFolder}
                  isDark={isDark}
                />
              )}

              {activeView === 'settings' && (
                <SettingsView
                  forums={forums}
                  alerts={alerts}
                  bookmarks={bookmarks}
                  quota={quota}
                  onImport={handleConfigImport}
                  onResetOnboarding={resetOnboarding}
                  isDark={isDark}
                />
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
