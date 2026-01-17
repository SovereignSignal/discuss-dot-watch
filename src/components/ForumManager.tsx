'use client';

import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Search,
  ChevronDown,
  ChevronRight,
  Star,
  Zap,
  Circle,
} from 'lucide-react';
import { Forum, ForumCategoryId } from '@/types';
import {
  FORUM_CATEGORIES,
  ForumPreset,
  searchForums,
  getTotalForumCount,
} from '@/lib/forumPresets';

interface ForumManagerProps {
  forums: Forum[];
  onAddForum: (forum: Omit<Forum, 'id' | 'createdAt'>) => void;
  onRemoveForum: (id: string) => void;
  onToggleForum: (id: string) => void;
}

const TIER_CONFIG = {
  1: {
    label: 'Tier 1',
    icon: Star,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
  },
  2: {
    label: 'Tier 2',
    icon: Zap,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  3: {
    label: 'Tier 3',
    icon: Circle,
    color: 'text-gray-400',
    bg: 'bg-gray-400/10',
  },
} as const;

export function ForumManager({
  forums,
  onAddForum,
  onRemoveForum,
  onToggleForum,
}: ForumManagerProps) {
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['l2-protocols', 'defi-lending', 'major-daos'])
  );
  const [activeTab, setActiveTab] = useState<'browse' | 'added'>('browse');

  const addedForumUrls = useMemo(
    () => new Set(forums.map((f) => f.discourseForum.url)),
    [forums]
  );

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return FORUM_CATEGORIES;

    const matchingForums = searchForums(searchQuery);
    const matchingUrls = new Set(matchingForums.map((f) => f.url));

    return FORUM_CATEGORIES.map((category) => ({
      ...category,
      forums: category.forums.filter((f) => matchingUrls.has(f.url)),
    })).filter((category) => category.forums.length > 0);
  }, [searchQuery]);

  const totalAvailable = getTotalForumCount();
  const totalAdded = forums.length;

  const handleAddForum = () => {
    if (!newUrl.trim()) return;

    const name =
      newName.trim() ||
      new URL(newUrl).hostname.replace('www.', '').split('.')[0];
    const cname = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    onAddForum({
      cname,
      name,
      category: 'custom',
      discourseForum: {
        url: newUrl.trim(),
        categoryId: newCategoryId ? parseInt(newCategoryId, 10) : undefined,
      },
      isEnabled: true,
    });

    setNewUrl('');
    setNewName('');
    setNewCategoryId('');
    setIsAdding(false);
  };

  const handleQuickAdd = (preset: ForumPreset, categoryId: string) => {
    if (addedForumUrls.has(preset.url)) return;

    const cname = preset.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    onAddForum({
      cname,
      name: preset.name,
      description: preset.description,
      token: preset.token,
      category: categoryId as ForumCategoryId,
      discourseForum: {
        url: preset.url,
        categoryId: preset.categoryId,
      },
      isEnabled: true,
    });
  };

  const handleAddAllInCategory = (categoryId: string) => {
    const category = FORUM_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;

    category.forums.forEach((preset) => {
      if (!addedForumUrls.has(preset.url)) {
        handleQuickAdd(preset, categoryId);
      }
    });
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const renderTierBadge = (tier: 1 | 2 | 3) => {
    const config = TIER_CONFIG[tier];
    const Icon = config.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${config.bg} ${config.color}`}
      >
        <Icon className="w-3 h-3" />
      </span>
    );
  };

  const renderForumPreset = (preset: ForumPreset, categoryId: string) => {
    const isAdded = addedForumUrls.has(preset.url);
    return (
      <button
        key={preset.url}
        onClick={() => handleQuickAdd(preset, categoryId)}
        disabled={isAdded}
        className={`group flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all ${
          isAdded
            ? 'bg-gray-800/30 cursor-not-allowed'
            : 'bg-gray-800/50 hover:bg-gray-700/50 hover:scale-[1.01]'
        }`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">
            {preset.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium truncate ${isAdded ? 'text-gray-500' : 'text-white'}`}
            >
              {preset.name}
            </span>
            {preset.token && (
              <span className="text-xs text-gray-500 font-mono">
                ${preset.token}
              </span>
            )}
            {renderTierBadge(preset.tier)}
            {isAdded && (
              <span className="text-xs text-green-500 font-medium">Added</span>
            )}
          </div>
          {preset.description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {preset.description}
            </p>
          )}
        </div>
        {!isAdded && (
          <Plus className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Manage Forums</h2>
        <div className="text-sm text-gray-400">
          {totalAdded} of {totalAvailable}+ forums added
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'browse'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Browse Forums
        </button>
        <button
          onClick={() => setActiveTab('added')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'added'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Your Forums ({forums.length})
        </button>
      </div>

      {activeTab === 'browse' ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search forums by name, token, or description..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Tier Legend */}
          <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              {renderTierBadge(1)} Highest activity
            </span>
            <span className="flex items-center gap-1.5">
              {renderTierBadge(2)} Active
            </span>
            <span className="flex items-center gap-1.5">
              {renderTierBadge(3)} Moderate
            </span>
          </div>

          {/* Categories */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredCategories.map((category) => {
              const isExpanded = expandedCategories.has(category.id);
              const addedInCategory = category.forums.filter((f) =>
                addedForumUrls.has(f.url)
              ).length;
              const totalInCategory = category.forums.length;

              return (
                <div
                  key={category.id}
                  className="bg-gray-900/50 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <div>
                        <h3 className="font-medium text-white">
                          {category.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">
                        {addedInCategory}/{totalInCategory}
                      </span>
                      {addedInCategory < totalInCategory && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddAllInCategory(category.id);
                          }}
                          className="px-2 py-1 text-xs bg-indigo-600/20 text-indigo-400 rounded hover:bg-indigo-600/30 transition-colors"
                        >
                          Add All
                        </button>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2">
                      {category.forums.map((preset) =>
                        renderForumPreset(preset, category.id)
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCategories.length === 0 && searchQuery && (
              <div className="text-center py-8 text-gray-500">
                No forums found matching &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Custom Forum */}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              Add Custom Forum
            </h3>
            {isAdding ? (
              <div className="space-y-3 p-4 bg-gray-800/50 rounded-lg">
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="Forum URL (e.g., https://governance.aave.com/)"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Display name (optional)"
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    placeholder="Category ID"
                    className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddForum}
                    disabled={!newUrl.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                  >
                    Add Forum
                  </button>
                  <button
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Custom Forum
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {forums.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                No forums added yet. Browse and add forums to get started.
              </p>
              <button
                onClick={() => setActiveTab('browse')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
              >
                Browse Forums
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {forums.map((forum) => (
                <div
                  key={forum.id}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    forum.isEnabled ? 'bg-gray-800' : 'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">
                        {forum.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-medium truncate ${forum.isEnabled ? 'text-white' : 'text-gray-500'}`}
                        >
                          {forum.name}
                        </p>
                        {forum.token && (
                          <span className="text-xs text-gray-500 font-mono">
                            ${forum.token}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {forum.discourseForum.url}
                        {forum.discourseForum.categoryId &&
                          ` · Category ${forum.discourseForum.categoryId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={forum.discourseForum.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-500 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => onToggleForum(forum.id)}
                      className="p-2 text-gray-500 hover:text-white transition-colors"
                    >
                      {forum.isEnabled ? (
                        <ToggleRight className="w-5 h-5 text-indigo-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => onRemoveForum(forum.id)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
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
    </div>
  );
}
