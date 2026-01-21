'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { DiscussionFeed } from '@/components/DiscussionFeed';
import { ForumManager } from '@/components/ForumManager';
import { RightSidebar } from '@/components/RightSidebar';
import { FilterTabs } from '@/components/FilterTabs';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useForums } from '@/hooks/useForums';
import { useDiscussions } from '@/hooks/useDiscussions';
import { useAlerts } from '@/hooks/useAlerts';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useTheme } from '@/hooks/useTheme';
import { useDebounce } from '@/hooks/useDebounce';
import { DiscussionTopic } from '@/types';
import { Bookmark as BookmarkIcon, ExternalLink, Trash2 } from 'lucide-react';

export default function Home() {
  const [activeView, setActiveView] = useState<'feed' | 'projects' | 'saved' | 'settings'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'your'>('your');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileAlertsOpen, setIsMobileAlertsOpen] = useState(false);
  
  const { forums, enabledForums, addForum, removeForum, toggleForum } = useForums();
  const { discussions, isLoading, error, lastUpdated, forumStates, refresh } = useDiscussions(enabledForums);
  const { alerts, addAlert, removeAlert, toggleAlert } = useAlerts();
  const { bookmarks, addBookmark, removeBookmark, isBookmarked } = useBookmarks();
  const { theme, toggleTheme } = useTheme();

  // Debounce search query to avoid filtering on every keystroke
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const handleToggleBookmark = useCallback((topic: DiscussionTopic) => {
    if (isBookmarked(topic.refId)) {
      removeBookmark(topic.refId);
    } else {
      addBookmark(topic);
    }
  }, [isBookmarked, removeBookmark, addBookmark]);

  useEffect(() => {
    if (enabledForums.length > 0 && discussions.length === 0 && !isLoading) {
      refresh();
    }
  }, [enabledForums.length, discussions.length, isLoading, refresh]);

  return (
    <ErrorBoundary>
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
        
        <main className="flex-1 flex overflow-hidden">
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
                enabledForumIds={enabledForums.map(f => f.id)}
                forumStates={forumStates}
                forums={enabledForums}
                isBookmarked={isBookmarked}
                onToggleBookmark={handleToggleBookmark}
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
                onRemoveForum={removeForum}
                onToggleForum={toggleForum}
              />
            </div>
          )}
          
          {activeView === 'saved' && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <BookmarkIcon className="w-5 h-5" />
                Saved Discussions
              </h2>
              {bookmarks.length === 0 ? (
                <div className="text-center py-12">
                  <BookmarkIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">No saved discussions yet</p>
                  <p className="text-gray-500 text-sm">Click the bookmark icon on any discussion to save it for later</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bookmarks.map((bookmark) => (
                    <div key={bookmark.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <a
                          href={bookmark.topicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white hover:text-indigo-400 font-medium line-clamp-1"
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
                          className="p-2 text-gray-400 hover:text-white transition-colors"
                          title="Open discussion"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => removeBookmark(bookmark.topicRefId)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Remove from saved"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === 'settings' && (
            <div className="flex-1 p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Settings</h2>
              <div className="space-y-4">
                <div className="p-4 bg-gray-800 rounded-lg">
                  <h3 className="font-medium text-white mb-2">About</h3>
                  <p className="text-gray-400 text-sm">
                    Governance Forum Aggregator - A unified view of governance discussions
                    from multiple Discourse-based forums used by DAOs and blockchain protocols.
                  </p>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <h3 className="font-medium text-white mb-2">Data Storage</h3>
                  <p className="text-gray-400 text-sm">
                    All forum configurations and alerts are stored locally in your browser.
                    No data is sent to any external servers except for fetching discussions
                    from the configured Discourse forums.
                  </p>
                </div>
                <div className="p-4 bg-gray-800 rounded-lg">
                  <h3 className="font-medium text-white mb-2">Refresh Rate</h3>
                  <p className="text-gray-400 text-sm">
                    Discussions are cached and can be manually refreshed using the Refresh button.
                    API responses are cached for 2 minutes to reduce load on forum servers.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
    </ErrorBoundary>
  );
}
