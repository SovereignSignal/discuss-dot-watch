'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { DiscussionFeed } from '@/components/DiscussionFeed';
import { ForumManager } from '@/components/ForumManager';
import { RightSidebar } from '@/components/RightSidebar';
import { FilterTabs } from '@/components/FilterTabs';
import { useForums } from '@/hooks/useForums';
import { useDiscussions } from '@/hooks/useDiscussions';
import { useAlerts } from '@/hooks/useAlerts';

export default function Home() {
  const [activeView, setActiveView] = useState<'feed' | 'projects' | 'settings'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'your'>('your');
  
  const { forums, enabledForums, addForum, removeForum, toggleForum } = useForums();
  const { discussions, isLoading, error, lastUpdated, refresh } = useDiscussions(enabledForums);
  const { alerts, addAlert, removeAlert, toggleAlert } = useAlerts();

  useEffect(() => {
    if (enabledForums.length > 0 && discussions.length === 0 && !isLoading) {
      refresh();
    }
  }, [enabledForums.length, discussions.length, isLoading, refresh]);

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      
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
                searchQuery={searchQuery}
                filterMode={filterMode}
                enabledForumIds={enabledForums.map(f => f.id)}
              />
              <RightSidebar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                alerts={alerts}
                onAddAlert={addAlert}
                onRemoveAlert={removeAlert}
                onToggleAlert={toggleAlert}
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
  );
}
