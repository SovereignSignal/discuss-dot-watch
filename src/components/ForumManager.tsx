'use client';

import { useState } from 'react';
import { Plus, Trash2, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { Forum } from '@/types';

interface ForumManagerProps {
  forums: Forum[];
  onAddForum: (forum: Omit<Forum, 'id' | 'createdAt'>) => void;
  onRemoveForum: (id: string) => void;
  onToggleForum: (id: string) => void;
}

const DEFAULT_FORUMS = [
  { name: 'Aave', url: 'https://governance.aave.com/', categoryId: 4 },
  { name: 'Compound', url: 'https://www.comp.xyz/' },
  { name: 'Lido', url: 'https://research.lido.fi/' },
  { name: 'Balancer', url: 'https://forum.balancer.fi/' },
  { name: 'ENS', url: 'https://discuss.ens.domains/' },
  { name: 'Arbitrum', url: 'https://forum.arbitrum.foundation/' },
  { name: 'Optimism', url: 'https://gov.optimism.io/' },
  { name: 'Uniswap', url: 'https://gov.uniswap.org/' },
];

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

  const handleAddForum = () => {
    if (!newUrl.trim()) return;
    
    const name = newName.trim() || new URL(newUrl).hostname.replace('www.', '').split('.')[0];
    const cname = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    onAddForum({
      cname,
      name,
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

  const handleQuickAdd = (preset: typeof DEFAULT_FORUMS[0]) => {
    const existing = forums.find(f => f.discourseForum.url === preset.url);
    if (existing) return;
    
    const cname = preset.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    onAddForum({
      cname,
      name: preset.name,
      discourseForum: {
        url: preset.url,
        categoryId: preset.categoryId,
      },
      isEnabled: true,
    });
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-white mb-6">Manage Forums</h2>
      
      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Quick Add Popular Forums</h3>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_FORUMS.map((preset) => {
            const exists = forums.some(f => f.discourseForum.url === preset.url);
            return (
              <button
                key={preset.url}
                onClick={() => handleQuickAdd(preset)}
                disabled={exists}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  exists
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30'
                }`}
              >
                {exists ? '✓ ' : '+ '}{preset.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Add Custom Forum</h3>
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

      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Your Forums ({forums.length})</h3>
        {forums.length === 0 ? (
          <p className="text-gray-500 text-sm">No forums added yet. Add some forums above to get started.</p>
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
                    <p className={`font-medium truncate ${forum.isEnabled ? 'text-white' : 'text-gray-500'}`}>
                      {forum.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {forum.discourseForum.url}
                      {forum.discourseForum.categoryId && ` · Category ${forum.discourseForum.categoryId}`}
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
    </div>
  );
}
