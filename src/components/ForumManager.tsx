'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  Square,
  CheckSquare,
  MinusSquare,
} from 'lucide-react';
import { Forum, ForumCategoryId } from '@/types';
import { getProtocolLogo } from '@/lib/logoUtils';
import { getThemeColors } from '@/lib/theme';
import {
  FORUM_CATEGORIES,
  ForumPreset,
  searchForums,
  getTotalForumCount,
} from '@/lib/forumPresets';
import { ConfirmDialog } from './ConfirmDialog';
import { normalizeUrl, isValidUrl } from '@/lib/url';

interface ForumManagerProps {
  forums: Forum[];
  onAddForum: (forum: Omit<Forum, 'id' | 'createdAt'>) => void;
  onRemoveForum: (id: string) => void;
  onToggleForum: (id: string) => void;
}

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
  const [activeTab, setActiveTab] = useState<'browse' | 'added'>(forums.length > 0 ? 'added' : 'browse');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  
  // Multi-select state
  const [selectedForumIds, setSelectedForumIds] = useState<Set<string>>(new Set());
  const [selectedBrowseUrls, setSelectedBrowseUrls] = useState<Set<string>>(new Set());

  // Theme detection - sync with localStorage
  const [isDark, setIsDark] = useState(true);
  
  useEffect(() => {
    const checkTheme = () => {
      const saved = localStorage.getItem('gov-watch-theme') || localStorage.getItem('discuss-watch-theme');
      setIsDark(saved !== 'light');
    };
    checkTheme();
    window.addEventListener('themechange', checkTheme);
    window.addEventListener('storage', checkTheme);
    return () => {
      window.removeEventListener('themechange', checkTheme);
      window.removeEventListener('storage', checkTheme);
    };
  }, []);

  // Use centralized theme colors
  const t = getThemeColors(isDark);
  const fg = t.text;
  const fgMuted = isDark ? '#e4e4e7' : '#4b5563';
  const fgDim = t.textSecondary;
  const border = t.borderSolid;
  const cardBg = t.cardBg;
  const activeBg = t.hover;

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

  const urlExists = (url: string) => addedForumUrls.has(normalizeUrl(url));

  // Find forum by URL for remove
  const findForumByUrl = (url: string) => {
    const normalized = normalizeUrl(url);
    return forums.find(f => normalizeUrl(f.discourseForum.url) === normalized);
  };

  const handleValidateAndAdd = async () => {
    if (!newUrl.trim()) return;
    if (!isValidUrl(newUrl)) {
      setValidationError('Please enter a valid URL');
      return;
    }
    const normalized = normalizeUrl(newUrl);
    if (urlExists(normalized)) {
      setValidationError('Already added');
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
        onAddForum({
          cname: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name,
          category: 'custom',
          discourseForum: { url: normalized, categoryId: newCategoryId ? parseInt(newCategoryId, 10) : undefined },
          isEnabled: true,
        });
        setTimeout(() => { setNewUrl(''); setNewName(''); setNewCategoryId(''); setIsAdding(false); setValidationSuccess(false); }, 500);
      } else {
        setValidationError(data.error || 'Not a valid Discourse forum');
      }
    } catch {
      setValidationError('Validation failed. Try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleQuickAdd = (preset: ForumPreset, categoryId: string) => {
    // If forum exists but is disabled, re-enable it
    const existing = findForumByUrl(preset.url);
    if (existing) {
      if (!existing.isEnabled) {
        onToggleForum(existing.id);
      }
      return;
    }
    onAddForum({
      cname: preset.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: preset.name,
      description: preset.description,
      token: preset.token,
      logoUrl: preset.logoUrl || getProtocolLogo(preset.name),
      category: categoryId as ForumCategoryId,
      discourseForum: { url: preset.url, categoryId: preset.categoryId },
      isEnabled: true,
    });
  };

  const handleAddAllInCategory = (categoryId: string) => {
    const category = FORUM_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;
    category.forums.forEach((preset) => { if (!urlExists(preset.url)) handleQuickAdd(preset, categoryId); });
  };

  // Multi-select helpers
  const toggleForumSelection = (id: string) => {
    setSelectedForumIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleBrowseSelection = (url: string) => {
    setSelectedBrowseUrls(prev => {
      const next = new Set(prev);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });
  };

  const enabledForums = forums.filter(f => f.isEnabled);
  const filteredEnabledForums = enabledForums.filter(f => {
    if (!categoryFilter) return true;
    const cat = (f.category || 'crypto').toLowerCase()
      .replace('crypto-governance', 'crypto').replace('ai-ml', 'ai').replace('open-source', 'oss');
    const mapped = cat.includes('ai') ? 'ai' : cat.includes('oss') || cat.includes('open') ? 'oss' : 'crypto';
    return mapped === categoryFilter;
  });

  const selectAllForums = () => {
    const allIds = new Set(filteredEnabledForums.map(f => f.id));
    setSelectedForumIds(allIds);
  };

  const deselectAllForums = () => {
    setSelectedForumIds(new Set());
  };

  const handleBulkRemove = () => {
    selectedForumIds.forEach(id => onRemoveForum(id));
    setSelectedForumIds(new Set());
  };

  const handleBulkAdd = () => {
    selectedBrowseUrls.forEach(url => {
      // Find the preset for this URL
      for (const category of FORUM_CATEGORIES) {
        const preset = category.forums.find(f => f.url === url);
        if (preset && !urlExists(preset.url)) {
          handleQuickAdd(preset, category.id);
        }
      }
    });
    setSelectedBrowseUrls(new Set());
  };

  const selectAllBrowse = (forums: ForumPreset[]) => {
    const urls = forums.filter(f => !urlExists(f.url)).map(f => f.url);
    setSelectedBrowseUrls(new Set(urls));
  };

  const deselectAllBrowse = () => {
    setSelectedBrowseUrls(new Set());
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId);
      return next;
    });
  };

  const renderForumPreset = (preset: ForumPreset, categoryId: string, showCheckbox = false) => {
    const existingForum = findForumByUrl(preset.url);
    const isEnabled = existingForum?.isEnabled ?? false;
    const isAdded = !!existingForum && isEnabled;
    const isSelected = selectedBrowseUrls.has(preset.url);
    const logoUrl = preset.logoUrl || getProtocolLogo(preset.name);

    return (
      <div key={preset.url} className="group flex items-center gap-3 w-full p-3 rounded-lg transition-all"
        style={{ backgroundColor: isAdded || isSelected ? cardBg : 'transparent', border: `1px solid ${isAdded || isSelected ? border : 'transparent'}` }}
        onMouseEnter={(e) => { if (!isAdded && !isSelected) e.currentTarget.style.backgroundColor = cardBg; }}
        onMouseLeave={(e) => { if (!isAdded && !isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        {showCheckbox && !isAdded && (
          <button onClick={() => toggleBrowseSelection(preset.url)} className="flex-shrink-0" style={{ color: fgDim }}>
            {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
        )}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)' }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const fallback = img.parentElement?.querySelector('[data-fallback]') as HTMLElement;
                if (fallback) fallback.style.display = '';
              }}
            />
          ) : null}
          <span data-fallback className="text-xs font-bold" style={{ color: fg, display: logoUrl ? 'none' : '' }}>
            {preset.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate" style={{ color: isAdded ? fgMuted : fg }}>{preset.name}</span>
            {preset.token && <span className="text-xs font-mono" style={{ color: fgDim }}>${preset.token}</span>}
            {isAdded && <span className="text-xs font-medium" style={{ color: fgMuted }}>added</span>}
          </div>
          {preset.description && (
            <p className="text-xs truncate mt-0.5" style={{ color: fgDim }}>{preset.description}</p>
          )}
        </div>
        {isAdded && existingForum ? (
          <button onClick={() => setDeleteConfirm({ id: existingForum.id, name: existingForum.name })}
            className="p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hover:text-red-500"
            style={{ color: fgDim }}>
            <X className="w-4 h-4" />
          </button>
        ) : !showCheckbox ? (
          <button onClick={() => handleQuickAdd(preset, categoryId)}
            className="p-2 rounded-lg transition-colors" style={{ color: fgDim }}>
            <Plus className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: fg }}>Communities</h2>
          <p className="text-sm mt-1" style={{ color: fgDim }}>
            {forums.filter(f => f.isEnabled).length} of {totalAvailable}+ forums added
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 p-1 rounded-lg mb-5" style={{ backgroundColor: isDark ? '#18181b' : 'rgba(0,0,0,0.03)' }}>
        <button onClick={() => setActiveTab('added')}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors"
          style={{ backgroundColor: activeTab === 'added' ? activeBg : 'transparent', color: activeTab === 'added' ? fg : fgDim }}>
          Your Forums ({forums.filter(f => f.isEnabled).length})
        </button>
        <button onClick={() => setActiveTab('browse')}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors"
          style={{ backgroundColor: activeTab === 'browse' ? activeBg : 'transparent', color: activeTab === 'browse' ? fg : fgDim }}>
          Browse All
        </button>
      </div>

      {activeTab === 'added' ? (
        <div className="flex-1 overflow-y-auto">
          {/* Category filters for Your Forums */}
          {forums.filter(f => f.isEnabled).length > 0 && (() => {
            const enabled = forums.filter(f => f.isEnabled);
            const counts: Record<string, number> = {};
            enabled.forEach(f => {
              const cat = (f.category || 'crypto').toLowerCase()
                .replace('crypto-governance', 'crypto').replace('ai-ml', 'ai').replace('open-source', 'oss');
              const mapped = cat.includes('ai') ? 'ai' : cat.includes('oss') || cat.includes('open') ? 'oss' : 'crypto';
              counts[mapped] = (counts[mapped] || 0) + 1;
            });
            const cats = [
              { key: null, label: 'All', count: enabled.length },
              ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({
                key, label: key.toUpperCase(), count,
              })),
            ];
            // Only show filter if there are multiple categories
            if (Object.keys(counts).length <= 1) return null;
            return (
              <div className="flex gap-1 mb-3">
                {cats.map(c => (
                  <button key={c.key ?? 'all'} onClick={() => setCategoryFilter(c.key)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
                    style={{
                      backgroundColor: categoryFilter === c.key ? activeBg : 'transparent',
                      color: categoryFilter === c.key ? fg : fgDim,
                      border: `1px solid ${categoryFilter === c.key ? border : 'transparent'}`,
                    }}>
                    {c.label} {c.count}
                  </button>
                ))}
              </div>
            );
          })()}
          {filteredEnabledForums.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center"
              style={{ borderColor: border }}>
              <p className="font-semibold" style={{ color: fg }}>No forums added yet</p>
              <p className="mt-1 text-sm" style={{ color: fgDim }}>Browse and add forums to get started</p>
              <button onClick={() => setActiveTab('browse')}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: activeBg, color: fg }}>
                Browse Forums
              </button>
            </div>
          ) : (
            <>
              {/* Bulk action bar */}
              <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: `1px solid ${border}` }}>
                <div className="flex items-center gap-3">
                  <button onClick={() => {
                    const allSelected = filteredEnabledForums.every(f => selectedForumIds.has(f.id));
                    allSelected ? deselectAllForums() : selectAllForums();
                  }} className="flex items-center gap-2 text-sm" style={{ color: fgDim }}>
                    {filteredEnabledForums.length > 0 && filteredEnabledForums.every(f => selectedForumIds.has(f.id)) ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : selectedForumIds.size > 0 ? (
                      <MinusSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                    {selectedForumIds.size > 0 ? `${selectedForumIds.size} selected` : 'Select all'}
                  </button>
                </div>
                {selectedForumIds.size > 0 && (
                  <button onClick={handleBulkRemove}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-red-500/10"
                    style={{ color: '#ef4444' }}>
                    <Trash2 className="w-4 h-4" />
                    Remove {selectedForumIds.size}
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {filteredEnabledForums.map((forum) => {
                  const logoUrl = forum.logoUrl || getProtocolLogo(forum.name);
                  const isSelected = selectedForumIds.has(forum.id);
                  return (
                    <div key={forum.id}
                      className="group flex items-center justify-between p-3 rounded-lg transition-colors"
                      style={{ backgroundColor: isSelected ? activeBg : cardBg, border: `1px solid ${isSelected ? fg : border}` }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = border; }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => toggleForumSelection(forum.id)} className="flex-shrink-0" style={{ color: fgDim }}>
                          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                          style={{ backgroundColor: isDark ? '#1f1f23' : 'rgba(0,0,0,0.05)' }}>
                          {logoUrl ? (
                            <img src={logoUrl} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.style.display = 'none';
                                const fallback = img.parentElement?.querySelector('[data-fallback]') as HTMLElement;
                                if (fallback) fallback.style.display = '';
                              }} />
                          ) : null}
                          <span data-fallback className="text-xs font-bold" style={{ color: fg, display: logoUrl ? 'none' : '' }}>
                            {forum.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate" style={{ color: fg }}>
                            {forum.name}
                            {forum.token && <span className="ml-2 font-mono text-xs" style={{ color: fgDim }}>${forum.token}</span>}
                          </p>
                          <p className="text-xs truncate" style={{ color: fgDim }}>
                            {forum.discourseForum.url}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={forum.discourseForum.url} target="_blank" rel="noopener noreferrer"
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: fgDim }}>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button onClick={() => setDeleteConfirm({ id: forum.id, name: forum.name })}
                          className="p-2 rounded-lg transition-colors hover:text-red-500"
                          style={{ color: fgDim }}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: fgDim }} />
            <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search forums..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
              style={{ backgroundColor: cardBg, border: `1px solid ${border}`, color: fg, outline: 'none' }}
            />
          </div>

          {/* Bulk add action bar */}
          {selectedBrowseUrls.size > 0 && (
            <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: `1px solid ${border}` }}>
              <div className="flex items-center gap-3">
                <button onClick={deselectAllBrowse} className="flex items-center gap-2 text-sm" style={{ color: fgDim }}>
                  <CheckSquare className="w-5 h-5" />
                  {selectedBrowseUrls.size} selected
                </button>
              </div>
              <button onClick={handleBulkAdd}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: fg, color: isDark ? '#000' : '#fff' }}>
                <Plus className="w-4 h-4" />
                Add {selectedBrowseUrls.size} forums
              </button>
            </div>
          )}

          {searchQuery.trim() ? (
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const matchingForums = searchForums(searchQuery);
                const notAddedForums = matchingForums.filter(f => !urlExists(f.url));
                if (matchingForums.length === 0) {
                  return <div className="text-center py-8 text-sm" style={{ color: fgDim }}>No forums found</div>;
                }
                return (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs" style={{ color: fgDim }}>{matchingForums.length} results</p>
                      {notAddedForums.length > 0 && (
                        <button onClick={() => selectAllBrowse(matchingForums)}
                          className="text-xs font-medium" style={{ color: fgMuted }}>
                          Select all not added
                        </button>
                      )}
                    </div>
                    {matchingForums.map((preset) => {
                      const category = FORUM_CATEGORIES.find(c => c.forums.some(f => f.url === preset.url));
                      return renderForumPreset(preset, category?.id || 'custom', true);
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredCategories.map((category) => {
                const isExpanded = expandedCategories.has(category.id);
                const addedCount = category.forums.filter((f) => urlExists(f.url)).length;
                const notAddedInCategory = category.forums.filter(f => !urlExists(f.url));
                return (
                  <div key={category.id}>
                    <button onClick={() => toggleCategory(category.id)}
                      className="flex items-center justify-between w-full p-3 rounded-lg text-left transition-colors"
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = cardBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4" style={{ color: fgDim }} /> : <ChevronRight className="w-4 h-4" style={{ color: fgDim }} />}
                        <div>
                          <h3 className="font-medium text-sm" style={{ color: fg }}>{category.name}</h3>
                          <p className="text-xs" style={{ color: fgDim }}>{category.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: fgDim }}>{addedCount}/{category.forums.length}</span>
                        {notAddedInCategory.length > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); handleAddAllInCategory(category.id); }}
                            className="px-2 py-1 text-xs font-medium rounded-md transition-colors"
                            style={{ backgroundColor: activeBg, color: fgMuted }}>
                            Add all
                          </button>
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="pl-6 space-y-0.5">
                        {notAddedInCategory.length > 1 && (
                          <button onClick={() => selectAllBrowse(notAddedInCategory)}
                            className="flex items-center gap-2 text-xs font-medium py-2 px-3" style={{ color: fgMuted }}>
                            <Square className="w-4 h-4" />
                            Select all in {category.name}
                          </button>
                        )}
                        {category.forums.map((preset) => renderForumPreset(preset, category.id, true))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Custom Forum */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: border }}>
            {isAdding ? (
              <div className="space-y-3">
                <div>
                  <input type="url" value={newUrl} onChange={(e) => { setNewUrl(e.target.value); setValidationError(null); }}
                    placeholder="Forum URL (e.g., https://governance.aave.com/)"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: cardBg, border: `1px solid ${validationError ? '#ef4444' : border}`, color: fg, outline: 'none' }}
                  />
                  {validationError && <p className="mt-1 text-sm flex items-center gap-1" style={{ color: '#ef4444' }}><XCircle className="w-4 h-4" />{validationError}</p>}
                  {validationSuccess && <p className="mt-1 text-sm flex items-center gap-1" style={{ color: '#10b981' }}><CheckCircle className="w-4 h-4" />Validated!</p>}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (auto)"
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: cardBg, border: `1px solid ${border}`, color: fg, outline: 'none' }}
                  />
                  <input type="number" value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} placeholder="Cat ID"
                    className="w-24 px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: cardBg, border: `1px solid ${border}`, color: fg, outline: 'none' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleValidateAndAdd} disabled={!newUrl.trim() || isValidating}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: fg, color: isDark ? '#000000' : '#fafafa' }}>
                    {isValidating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isValidating ? 'Validating...' : 'Add Forum'}
                  </button>
                  <button onClick={() => { setIsAdding(false); setValidationError(null); setNewUrl(''); setNewName(''); setNewCategoryId(''); }}
                    className="px-3 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: activeBg, color: fgMuted }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: activeBg, color: fgMuted }}>
                <Plus className="w-4 h-4" />
                Add Custom Forum
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Remove Forum"
        message={`Remove "${deleteConfirm?.name}" from your watch list?`}
        confirmLabel="Remove"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={() => { if (deleteConfirm) { onRemoveForum(deleteConfirm.id); setDeleteConfirm(null); } }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
