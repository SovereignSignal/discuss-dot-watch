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
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Forum, ForumCategoryId } from '@/types';
import {
  FORUM_CATEGORIES,
  ForumPreset,
  searchForums,
  getTotalForumCount,
} from '@/lib/forumPresets';
import { ConfirmDialog } from './ConfirmDialog';
import { Tooltip } from './Tooltip';
import { normalizeUrl, isValidUrl } from '@/lib/url';

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
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  2: {
    label: 'Tier 2',
    icon: Zap,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
  },
  3: {
    label: 'Tier 3',
    icon: Circle,
    color: 'text-neutral-400',
    bg: 'bg-neutral-400/10',
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
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const addedForumUrls = useMemo(
    () => new Set(forums.map((f) => normalizeUrl(f.discourseForum.url))),
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

  const urlExists = (url: string) => {
    const normalized = normalizeUrl(url);
    return addedForumUrls.has(normalized);
  };

  const handleValidateAndAdd = async () => {
    if (!newUrl.trim()) return;

    if (!isValidUrl(newUrl)) {
      setValidationError('Please enter a valid URL (e.g., https://forum.example.com/)');
      return;
    }

    const normalized = normalizeUrl(newUrl);
    if (urlExists(normalized)) {
      setValidationError('This forum has already been added');
      return;
    }

    setIsValidating(true);
    setValidationError(null);
    setValidationSuccess(false);

    try {
      const response = await fetch(`/api/validate-discourse?url=${encodeURIComponent(normalized)}`);
      const data = await response.json();

      if (data.valid) {
        setValidationSuccess(true);
        const name = newName.trim() || data.name || new URL(normalized).hostname.replace('www.', '').split('.')[0];
        const cname = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        onAddForum({
          cname,
          name,
          category: 'custom',
          discourseForum: {
            url: normalized,
            categoryId: newCategoryId ? parseInt(newCategoryId, 10) : undefined,
          },
          isEnabled: true,
        });

        setTimeout(() => {
          setNewUrl('');
          setNewName('');
          setNewCategoryId('');
          setIsAdding(false);
          setValidationSuccess(false);
        }, 500);
      } else {
        setValidationError(data.error || 'Could not verify this is a Discourse forum');
      }
    } catch {
      setValidationError('Failed to validate forum URL. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleQuickAdd = (preset: ForumPreset, categoryId: string) => {
    if (urlExists(preset.url)) return;

    const cname = preset.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    onAddForum({
      cname,
      name: preset.name,
      description: preset.description,
      token: preset.token,
      logoUrl: preset.logoUrl,
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
      if (!urlExists(preset.url)) {
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

  const handleDeleteClick = (forum: Forum) => {
    setDeleteConfirm({ id: forum.id, name: forum.name });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      onRemoveForum(deleteConfirm.id);
      setDeleteConfirm(null);
    }
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
    const isAdded = urlExists(preset.url);
    return (
      <button
        key={preset.url}
        onClick={() => handleQuickAdd(preset, categoryId)}
        disabled={isAdded}
        aria-label={isAdded ? `${preset.name} already added` : `Add ${preset.name} forum`}
        className={`group flex items-center gap-3 w-full p-3 min-h-[56px] rounded-lg text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          isAdded
            ? 'bg-neutral-800/30 cursor-not-allowed'
            : 'bg-neutral-800/50 hover:bg-neutral-700/50 motion-safe:hover:scale-[1.01]'
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-900 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {preset.logoUrl ? (
            <img
              src={preset.logoUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}
          <span 
            className="text-white text-xs font-bold"
            style={{ display: preset.logoUrl ? 'none' : 'flex' }}
          >
            {preset.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-medium truncate ${isAdded ? 'theme-text-muted' : 'theme-text'}`}
            >
              {preset.name}
            </span>
            {preset.token && (
              <span className="text-xs theme-text-muted font-mono">
                ${preset.token}
              </span>
            )}
            {renderTierBadge(preset.tier)}
            {isAdded && (
              <span className="text-xs text-emerald-500 font-medium">Added</span>
            )}
          </div>
          {preset.description && (
            <p className="text-xs theme-text-muted truncate mt-0.5">
              {preset.description}
            </p>
          )}
        </div>
        {!isAdded && (
          <Plus className="w-4 h-4 theme-text-muted group-hover:text-indigo-400 transition-colors flex-shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold theme-text">Manage Forums</h2>
        <div className="text-sm theme-text-muted">
          {totalAdded} of {totalAvailable}+ forums added
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4" role="tablist" aria-label="Forum management tabs">
        <button
          onClick={() => setActiveTab('browse')}
          role="tab"
          aria-selected={activeTab === 'browse'}
          aria-controls="browse-panel"
          className={`px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'browse'
              ? 'bg-indigo-600 text-white'
              : 'bg-neutral-800 theme-text-muted hover:theme-text'
          }`}
        >
          Browse Forums
        </button>
        <button
          onClick={() => setActiveTab('added')}
          role="tab"
          aria-selected={activeTab === 'added'}
          aria-controls="added-panel"
          className={`px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeTab === 'added'
              ? 'bg-indigo-600 text-white'
              : 'bg-neutral-800 theme-text-muted hover:theme-text'
          }`}
        >
          Your Forums ({forums.length})
        </button>
      </div>

      {activeTab === 'browse' ? (
        <div id="browse-panel" role="tabpanel" aria-labelledby="browse-tab" className="flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative mb-4">
            <label htmlFor="forum-search" className="sr-only">Search forums</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-muted" aria-hidden="true" />
            <input
              id="forum-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search forums by name, token, or description..."
              className="w-full pl-10 pr-4 py-2.5 min-h-[44px] theme-card theme-text placeholder-neutral-500 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              style={{ borderColor: 'var(--card-border)' }}
            />
          </div>

          {/* Tier Legend */}
          <div className="flex items-center gap-4 mb-4 text-xs theme-text-muted">
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
                urlExists(f.url)
              ).length;
              const totalInCategory = category.forums.length;

              return (
                <div
                  key={category.id}
                  className="bg-neutral-900/50 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center justify-between w-full p-4 min-h-[56px] text-left hover:bg-neutral-800/50 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset"
                    aria-expanded={isExpanded}
                    aria-controls={`category-${category.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 theme-text-muted" />
                      ) : (
                        <ChevronRight className="w-4 h-4 theme-text-muted" />
                      )}
                      <div>
                        <h3 className="font-medium theme-text">
                          {category.name}
                        </h3>
                        <p className="text-xs theme-text-muted">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm theme-text-muted">
                        {addedInCategory}/{totalInCategory}
                      </span>
                      {addedInCategory < totalInCategory && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddAllInCategory(category.id);
                          }}
                          className="px-2 py-1 text-xs bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/30 transition-colors"
                          aria-label={`Add all forums in ${category.name}`}
                        >
                          Add All
                        </button>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div id={`category-${category.id}`} className="px-4 pb-4 space-y-2">
                      {category.forums.map((preset) =>
                        renderForumPreset(preset, category.id)
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCategories.length === 0 && searchQuery && (
              <div className="text-center py-8 theme-text-muted">
                No forums found matching &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Custom Forum */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <h3 className="text-sm font-medium theme-text-muted mb-3">
              Add Custom Forum
            </h3>
            {isAdding ? (
              <div className="space-y-3 p-4 bg-neutral-800/50 rounded-lg">
                <div>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => {
                      setNewUrl(e.target.value);
                      setValidationError(null);
                    }}
                    placeholder="Forum URL (e.g., https://governance.aave.com/)"
                    aria-label="Forum URL"
                    aria-invalid={!!validationError}
                    className={`w-full px-3 py-2 theme-card theme-text placeholder-neutral-500 rounded-lg focus:outline-none ${
                      validationError ? 'border-rose-500' : 'focus:border-indigo-500'
                    }`}
                    style={{ borderColor: validationError ? undefined : 'var(--card-border)' }}
                  />
                  {validationError && (
                    <p className="mt-1 text-sm text-rose-400 flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      {validationError}
                    </p>
                  )}
                  {validationSuccess && (
                    <p className="mt-1 text-sm text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Forum validated successfully!
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Display name (auto-detected)"
                    aria-label="Forum display name"
                    className="flex-1 px-3 py-2 theme-card theme-text placeholder-neutral-500 rounded-lg focus:outline-none focus:border-indigo-500"
                    style={{ borderColor: 'var(--card-border)' }}
                  />
                  <input
                    type="number"
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    placeholder="Category ID"
                    aria-label="Category ID filter"
                    className="w-32 px-3 py-2 theme-card theme-text placeholder-neutral-500 rounded-lg focus:outline-none focus:border-indigo-500"
                    style={{ borderColor: 'var(--card-border)' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleValidateAndAdd}
                    disabled={!newUrl.trim() || isValidating}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                  >
                    {isValidating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isValidating ? 'Validating...' : 'Add Forum'}
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setValidationError(null);
                      setNewUrl('');
                      setNewName('');
                      setNewCategoryId('');
                    }}
                    className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 theme-text-secondary text-sm rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Custom Forum
              </button>
            )}
          </div>
        </div>
      ) : (
        <div id="added-panel" role="tabpanel" aria-labelledby="added-tab" className="flex-1 overflow-y-auto">
          {forums.length === 0 ? (
            <div className="text-center py-12">
              <p className="theme-text-muted mb-4">
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
                    forum.isEnabled ? 'bg-neutral-800' : 'bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-900 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {forum.logoUrl ? (
                        <img
                          src={forum.logoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span 
                        className="text-white text-xs font-bold"
                        style={{ display: forum.logoUrl ? 'none' : 'flex' }}
                      >
                        {forum.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-medium truncate ${forum.isEnabled ? 'theme-text' : 'theme-text-muted'}`}
                        >
                          {forum.name}
                        </p>
                        {forum.token && (
                          <span className="text-xs theme-text-muted font-mono">
                            ${forum.token}
                          </span>
                        )}
                      </div>
                      <p className="text-xs theme-text-muted truncate">
                        {forum.discourseForum.url}
                        {forum.discourseForum.categoryId &&
                          ` · Category ${forum.discourseForum.categoryId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Tooltip content={`Open ${forum.name}`}>
                      <a
                        href={forum.discourseForum.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 theme-text-muted hover:theme-text transition-colors"
                        aria-label={`Open ${forum.name} forum in new tab`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Tooltip>
                    <Tooltip content={forum.isEnabled ? 'Disable' : 'Enable'}>
                      <button
                        onClick={() => onToggleForum(forum.id)}
                        className="p-2 theme-text-muted hover:theme-text transition-colors"
                        aria-label={forum.isEnabled ? `Disable ${forum.name} forum` : `Enable ${forum.name} forum`}
                      >
                        {forum.isEnabled ? (
                          <ToggleRight className="w-5 h-5 text-indigo-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                    </Tooltip>
                    <Tooltip content="Remove">
                      <button
                        onClick={() => handleDeleteClick(forum)}
                        className="p-2 theme-text-muted hover:text-rose-400 transition-colors"
                        aria-label={`Remove ${forum.name} forum`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Remove Forum"
        message={`Are you sure you want to remove "${deleteConfirm?.name}"? This will remove it from your watch list.`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
