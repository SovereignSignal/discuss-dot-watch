'use client';

import { useState, useMemo } from 'react';
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
import { c } from '@/lib/theme';
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
  isDark?: boolean;
}

export function ForumManager({
  forums,
  onAddForum,
  onRemoveForum,
  onToggleForum,
  isDark: isDarkProp,
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

  const isDark = isDarkProp ?? true;

  const t = c(isDark);

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
    const existing = findForumByUrl(preset.url);
    if (existing) {
      if (!existing.isEnabled) onToggleForum(existing.id);
      return;
    }
    onAddForum({
      cname: preset.sourceId || preset.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: preset.name,
      description: preset.description,
      token: preset.token,
      logoUrl: preset.logoUrl || getProtocolLogo(preset.name),
      category: categoryId as ForumCategoryId,
      sourceType: preset.sourceType,
      discourseForum: { url: preset.url, categoryId: preset.categoryId },
      isEnabled: true,
    });
  };

  const handleAddAllInCategory = (categoryId: string) => {
    const category = FORUM_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;
    category.forums.forEach((preset) => { if (!urlExists(preset.url)) handleQuickAdd(preset, categoryId); });
  };

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

  const selectAllForums = () => setSelectedForumIds(new Set(filteredEnabledForums.map(f => f.id)));
  const deselectAllForums = () => setSelectedForumIds(new Set());

  const handleBulkRemove = () => {
    selectedForumIds.forEach(id => onRemoveForum(id));
    setSelectedForumIds(new Set());
  };

  const handleBulkAdd = () => {
    selectedBrowseUrls.forEach(url => {
      for (const category of FORUM_CATEGORIES) {
        const preset = category.forums.find(f => f.url === url);
        if (preset && !urlExists(preset.url)) handleQuickAdd(preset, category.id);
      }
    });
    setSelectedBrowseUrls(new Set());
  };

  const selectAllBrowse = (forums: ForumPreset[]) => {
    setSelectedBrowseUrls(new Set(forums.filter(f => !urlExists(f.url)).map(f => f.url)));
  };

  const deselectAllBrowse = () => setSelectedBrowseUrls(new Set());

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
        style={{ backgroundColor: isAdded || isSelected ? t.bgCard : 'transparent', border: `1px solid ${isAdded || isSelected ? t.border : 'transparent'}` }}
        onMouseEnter={(e) => { if (!isAdded && !isSelected) e.currentTarget.style.backgroundColor = t.bgCard; }}
        onMouseLeave={(e) => { if (!isAdded && !isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        {showCheckbox && !isAdded && (
          <button onClick={() => toggleBrowseSelection(preset.url)} className="flex-shrink-0" style={{ color: t.fgDim }}>
            {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
        )}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: t.bgBadge }}>
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
          <span data-fallback className="text-xs font-bold" style={{ color: t.fg, display: logoUrl ? 'none' : '' }}>
            {preset.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate" style={{ color: isAdded ? t.fgMuted : t.fg }}>{preset.name}</span>
            {preset.token && <span className="text-xs font-mono" style={{ color: t.fgDim }}>${preset.token}</span>}
            {preset.sourceType && preset.sourceType !== 'discourse' && !preset.token && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ backgroundColor: t.bgBadge, color: t.fgDim }}>
                {preset.sourceType === 'github' ? 'GitHub' :
                 preset.sourceType === 'snapshot' ? 'Snapshot' :
                 preset.sourceType === 'ea-forum' ? 'EA Forum' : preset.sourceType}
              </span>
            )}
            {isAdded && <span className="text-xs font-medium" style={{ color: t.fgMuted }}>added</span>}
          </div>
          {preset.description && (
            <p className="text-xs truncate mt-0.5" style={{ color: t.fgDim }}>{preset.description}</p>
          )}
        </div>
        {isAdded && existingForum ? (
          <button onClick={() => setDeleteConfirm({ id: existingForum.id, name: existingForum.name })}
            className="p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hover:text-red-500"
            style={{ color: t.fgDim }}>
            <X className="w-4 h-4" />
          </button>
        ) : !showCheckbox ? (
          <button onClick={() => handleQuickAdd(preset, categoryId)}
            className="p-2 rounded-lg transition-colors" style={{ color: t.fgDim }}>
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
          <h2 className="text-2xl font-bold" style={{ color: t.fg }}>Communities</h2>
          <p className="text-sm mt-1" style={{ color: t.fgDim }}>
            {forums.filter(f => f.isEnabled).length} of {totalAvailable}+ forums added
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 p-1 rounded-lg mb-5" style={{ backgroundColor: t.bgCard }}>
        <button onClick={() => setActiveTab('added')}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors"
          style={{ backgroundColor: activeTab === 'added' ? t.bgActive : 'transparent', color: activeTab === 'added' ? t.fg : t.fgDim }}>
          Your Forums ({forums.filter(f => f.isEnabled).length})
        </button>
        <button onClick={() => setActiveTab('browse')}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors"
          style={{ backgroundColor: activeTab === 'browse' ? t.bgActive : 'transparent', color: activeTab === 'browse' ? t.fg : t.fgDim }}>
          Browse All
        </button>
      </div>

      {activeTab === 'added' ? (
        <div className="flex-1 overflow-y-auto">
          {/* Category filters */}
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
            if (Object.keys(counts).length <= 1) return null;
            return (
              <div className="flex gap-1 mb-3">
                {cats.map(c => (
                  <button key={c.key ?? 'all'} onClick={() => setCategoryFilter(c.key)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
                    style={{
                      backgroundColor: categoryFilter === c.key ? t.bgActive : 'transparent',
                      color: categoryFilter === c.key ? t.fg : t.fgDim,
                      border: `1px solid ${categoryFilter === c.key ? t.border : 'transparent'}`,
                    }}>
                    {c.label} {c.count}
                  </button>
                ))}
              </div>
            );
          })()}
          {filteredEnabledForums.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center"
              style={{ borderColor: t.border }}>
              <p className="font-semibold" style={{ color: t.fg }}>No forums added yet</p>
              <p className="mt-1 text-sm" style={{ color: t.fgDim }}>Browse and add forums to get started</p>
              <button onClick={() => setActiveTab('browse')}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: t.bgActive, color: t.fg }}>
                Browse Forums
              </button>
            </div>
          ) : (
            <>
              {/* Bulk action bar */}
              <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                <div className="flex items-center gap-3">
                  <button onClick={() => {
                    const allSelected = filteredEnabledForums.every(f => selectedForumIds.has(f.id));
                    allSelected ? deselectAllForums() : selectAllForums();
                  }} className="flex items-center gap-2 text-sm" style={{ color: t.fgDim }}>
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
                      style={{ backgroundColor: isSelected ? t.bgActive : t.bgCard, border: `1px solid ${isSelected ? t.fg : t.border}` }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = t.borderActive; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = t.border; }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => toggleForumSelection(forum.id)} className="flex-shrink-0" style={{ color: t.fgDim }}>
                          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                          style={{ backgroundColor: t.bgBadge }}>
                          {logoUrl ? (
                            <img src={logoUrl} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer"
                              onError={(e) => {
                                const img = e.target as HTMLImageElement;
                                img.style.display = 'none';
                                const fallback = img.parentElement?.querySelector('[data-fallback]') as HTMLElement;
                                if (fallback) fallback.style.display = '';
                              }} />
                          ) : null}
                          <span data-fallback className="text-xs font-bold" style={{ color: t.fg, display: logoUrl ? 'none' : '' }}>
                            {forum.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate" style={{ color: t.fg }}>
                            {forum.name}
                            {forum.token && <span className="ml-2 font-mono text-xs" style={{ color: t.fgDim }}>${forum.token}</span>}
                          </p>
                          <p className="text-xs truncate" style={{ color: t.fgDim }}>
                            {forum.discourseForum.url}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={forum.discourseForum.url} target="_blank" rel="noopener noreferrer"
                          className="p-2 rounded-lg transition-colors" style={{ color: t.fgDim }}>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button onClick={() => setDeleteConfirm({ id: forum.id, name: forum.name })}
                          className="p-2 rounded-lg transition-colors hover:text-red-500" style={{ color: t.fgDim }}>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: t.fgDim }} />
            <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search forums..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
              style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.fg, outline: 'none' }}
            />
          </div>

          {/* Bulk add action bar */}
          {selectedBrowseUrls.size > 0 && (
            <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: `1px solid ${t.border}` }}>
              <div className="flex items-center gap-3">
                <button onClick={deselectAllBrowse} className="flex items-center gap-2 text-sm" style={{ color: t.fgDim }}>
                  <CheckSquare className="w-5 h-5" />
                  {selectedBrowseUrls.size} selected
                </button>
              </div>
              <button onClick={handleBulkAdd}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: t.fg, color: isDark ? '#000' : '#fff' }}>
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
                  return <div className="text-center py-8 text-sm" style={{ color: t.fgDim }}>No forums found</div>;
                }
                return (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs" style={{ color: t.fgDim }}>{matchingForums.length} results</p>
                      {notAddedForums.length > 0 && (
                        <button onClick={() => selectAllBrowse(matchingForums)}
                          className="text-xs font-medium" style={{ color: t.fgMuted }}>
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
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = t.bgCard; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="w-4 h-4" style={{ color: t.fgDim }} /> : <ChevronRight className="w-4 h-4" style={{ color: t.fgDim }} />}
                        <div>
                          <h3 className="font-medium text-sm" style={{ color: t.fg }}>{category.name}</h3>
                          <p className="text-xs" style={{ color: t.fgDim }}>{category.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: t.fgDim }}>{addedCount}/{category.forums.length}</span>
                        {notAddedInCategory.length > 0 && (
                          <button onClick={(e) => { e.stopPropagation(); handleAddAllInCategory(category.id); }}
                            className="px-2 py-1 text-xs font-medium rounded-md transition-colors"
                            style={{ backgroundColor: t.bgActive, color: t.fgMuted }}>
                            Add all
                          </button>
                        )}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="pl-6 space-y-0.5">
                        {notAddedInCategory.length > 1 && (
                          <button onClick={() => selectAllBrowse(notAddedInCategory)}
                            className="flex items-center gap-2 text-xs font-medium py-2 px-3" style={{ color: t.fgMuted }}>
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
          <div className="mt-4 pt-4 border-t" style={{ borderColor: t.border }}>
            {isAdding ? (
              <div className="space-y-3">
                <div>
                  <input type="url" value={newUrl} onChange={(e) => { setNewUrl(e.target.value); setValidationError(null); }}
                    placeholder="Forum URL (e.g., https://governance.aave.com/)"
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${validationError ? '#ef4444' : t.border}`, color: t.fg, outline: 'none' }}
                  />
                  {validationError && <p className="mt-1 text-sm flex items-center gap-1" style={{ color: '#ef4444' }}><XCircle className="w-4 h-4" />{validationError}</p>}
                  {validationSuccess && <p className="mt-1 text-sm flex items-center gap-1" style={{ color: '#10b981' }}><CheckCircle className="w-4 h-4" />Validated!</p>}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (auto)"
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.fg, outline: 'none' }}
                  />
                  <input type="number" value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} placeholder="Cat ID"
                    className="w-24 px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: t.bgCard, border: `1px solid ${t.border}`, color: t.fg, outline: 'none' }}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleValidateAndAdd} disabled={!newUrl.trim() || isValidating}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: t.fg, color: isDark ? '#000000' : '#fafafa' }}>
                    {isValidating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isValidating ? 'Validating...' : 'Add Forum'}
                  </button>
                  <button onClick={() => { setIsAdding(false); setValidationError(null); setNewUrl(''); setNewName(''); setNewCategoryId(''); }}
                    className="px-3 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: t.bgActive, color: t.fgMuted }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: t.bgActive, color: t.fgMuted }}>
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
        isDark={isDark}
      />
    </div>
  );
}
