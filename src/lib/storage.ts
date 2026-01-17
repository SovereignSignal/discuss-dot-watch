import { Forum, KeywordAlert } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const FORUMS_KEY = 'gov-forum-watcher-forums';
const ALERTS_KEY = 'gov-forum-watcher-alerts';

export function getForums(): Forum[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(FORUMS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveForums(forums: Forum[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(FORUMS_KEY, JSON.stringify(forums));
}

export function addForum(forum: Omit<Forum, 'id' | 'createdAt'>): Forum {
  const forums = getForums();
  const newForum: Forum = {
    ...forum,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  forums.push(newForum);
  saveForums(forums);
  return newForum;
}

export function updateForum(id: string, updates: Partial<Forum>): Forum | null {
  const forums = getForums();
  const index = forums.findIndex(f => f.id === id);
  if (index === -1) return null;
  forums[index] = { ...forums[index], ...updates };
  saveForums(forums);
  return forums[index];
}

export function removeForum(id: string): boolean {
  const forums = getForums();
  const filtered = forums.filter(f => f.id !== id);
  if (filtered.length === forums.length) return false;
  saveForums(filtered);
  return true;
}

export function toggleForum(id: string): Forum | null {
  const forums = getForums();
  const forum = forums.find(f => f.id === id);
  if (!forum) return null;
  return updateForum(id, { isEnabled: !forum.isEnabled });
}

export function getAlerts(): KeywordAlert[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(ALERTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveAlerts(alerts: KeywordAlert[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function addAlert(keyword: string): KeywordAlert {
  const alerts = getAlerts();
  const newAlert: KeywordAlert = {
    id: uuidv4(),
    keyword,
    createdAt: new Date().toISOString(),
    isEnabled: true,
  };
  alerts.push(newAlert);
  saveAlerts(alerts);
  return newAlert;
}

export function removeAlert(id: string): boolean {
  const alerts = getAlerts();
  const filtered = alerts.filter(a => a.id !== id);
  if (filtered.length === alerts.length) return false;
  saveAlerts(filtered);
  return true;
}

export function toggleAlert(id: string): KeywordAlert | null {
  const alerts = getAlerts();
  const index = alerts.findIndex(a => a.id === id);
  if (index === -1) return null;
  alerts[index] = { ...alerts[index], isEnabled: !alerts[index].isEnabled };
  saveAlerts(alerts);
  return alerts[index];
}
