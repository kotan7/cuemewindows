import React, { useState, useCallback, useRef, useEffect } from 'react';

interface UseVerticalResizeOptions {
  minHeight?: number;
  maxHeight?: number;
  initialHeight?: number;
}

export const useVerticalResize = (options: UseVerticalResizeOptions = {}) => {
  const {
    minHeight = 200,
    maxHeight = 600,
    initialHeight = 320
  } = options;

  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    
    // Add cursor style to body
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [height]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaY = e.clientY - startYRef.current;
    const newHeight = Math.min(
      Math.max(startHeightRef.current + deltaY, minHeight),
      maxHeight
    );
    
    setHeight(newHeight);
  }, [isResizing, minHeight, maxHeight]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const ResizeHandle = () => React.createElement('div', {
    className: "absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize transition-colors flex items-center justify-center group",
    onMouseDown: handleMouseDown
  }, React.createElement('div', {
    className: "w-8 h-0.5 bg-transparent group-hover:bg-white/30 transition-colors rounded-full"
  }));

  return {
    height,
    isResizing,
    resizeRef,
    ResizeHandle,
    setHeight
  };
};