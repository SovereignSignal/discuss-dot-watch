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
} from 'lucide-react';
import { Forum, ForumCategoryId } from '@/types';
import { getProtocolLogo } from '@/lib/logoUtils';
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
}

export function ForumManager({
  forums,
  onAddForum,
  onRemoveForum,
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
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  // Theme detection from document
  const isDark = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light') : true;
  const fg = isDark ? '#fafafa' : '#09090b';
  const fgMuted = isDark ? '#a1a1aa' : '#71717a';
  const fgDim = isDark ? '#52525b' : '#a1a1aa';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const activeBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

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
    if (urlExists(preset.url)) return;
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

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(categoryId) ? next.delete(categoryId) : next.add(categoryId);
      return next;
    });
  };

  const renderForumPreset = (preset: ForumPreset, categoryId: string) => {
    const isAdded = urlExists(preset.url);
    const logoUrl = preset.logoUrl || getProtocolLogo(preset.name);
    const existingForum = isAdded ? findForumByUrl(preset.url) : null;

    return (
      <div key={preset.url} className="group flex items-center gap-3 w-full p-3 rounded-lg transition-all"
        style={{ backgroundColor: isAdded ? cardBg : 'transparent', border: `1px solid ${isAdded ? border : 'transparent'}` }}
        onMouseEnter={(e) => { if (!isAdded) e.currentTarget.style.backgroundColor = cardBg; }}
        onMouseLeave={(e) => { if (!isAdded) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-xs font-bold" style={{ color: fg }}>{preset.name.slice(0, 2).toUpperCase()}</span>
          )}
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
        ) : !isAdded ? (
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
      <div className="flex gap-0.5 p-1 rounded-lg mb-5" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
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
          {forums.filter(f => f.isEnabled).length === 0 ? (
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
            <div className="space-y-1">
              {forums.filter(f => f.isEnabled).map((forum) => {
                const logoUrl = forum.logoUrl || getProtocolLogo(forum.name);
                return (
                  <div key={forum.id}
                    className="group flex items-center justify-between p-3 rounded-lg transition-colors"
                    style={{ backgroundColor: cardBg, border: `1px solid ${border}` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = border; }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="text-xs font-bold" style={{ color: fg }}>{forum.name.slice(0, 2).toUpperCase()}</span>
                        )}
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
                        className="p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        style={{ color: fgDim }}>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button onClick={() => setDeleteConfirm({ id: forum.id, name: forum.name })}
                        className="p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 hover:text-red-500"
                        style={{ color: fgDim }}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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

          {searchQuery.trim() ? (
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const matchingForums = searchForums(searchQuery);
                if (matchingForums.length === 0) {
                  return <div className="text-center py-8 text-sm" style={{ color: fgDim }}>No forums found</div>;
                }
                return (
                  <div className="space-y-1">
                    <p className="text-xs mb-3" style={{ color: fgDim }}>{matchingForums.length} results</p>
                    {matchingForums.map((preset) => {
                      const category = FORUM_CATEGORIES.find(c => c.forums.some(f => f.url === preset.url));
                      return renderForumPreset(preset, category?.id || 'custom');
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
                        {addedCount < category.forums.length && (
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
                        {category.forums.map((preset) => renderForumPreset(preset, category.id))}
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
                    style={{ backgroundColor: fg, color: isDark ? '#09090b' : '#fafafa' }}>
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
