import { useState, useEffect, RefObject } from 'react';

export const useDraggable = (ref: RefObject<HTMLElement>) => {
  const [position, setPosition] = useState({ 
    x: Math.max(0, window.innerWidth - 120), 
    y: Math.max(20, window.innerHeight / 2 - 350) 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - (ref.current?.offsetWidth || 60), e.clientX - dragOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - (ref.current?.offsetHeight || 500), e.clientY - dragOffset.y)),
        });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  return { position, setPosition, handleMouseDown, isDragging };
};
