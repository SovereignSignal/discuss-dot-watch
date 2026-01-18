'use client';

import { useState, ReactNode, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: ReactNode;
}

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  
  const isClient = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsVisible(true);
  };

  const tooltip = isVisible && isClient ? createPortal(
    <div
      className="fixed z-[9999] px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg whitespace-nowrap pointer-events-none -translate-x-1/2 -translate-y-full"
      style={{ top: position.top, left: position.left }}
      role="tooltip"
    >
      {content}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-t-gray-900 border-x-transparent border-b-transparent" />
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={handleMouseEnter}
        onBlur={() => setIsVisible(false)}
      >
        {children}
      </div>
      {tooltip}
    </>
  );
}
