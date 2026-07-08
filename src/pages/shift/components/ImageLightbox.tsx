import { useState, useRef, useCallback, useEffect } from 'react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clampScale = useCallback((s: number) => Math.min(Math.max(s, 0.5), 5), []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setScale((prev) => clampScale(prev + delta));
    },
    [clampScale],
  );

  const zoomIn = useCallback(() => setScale((prev) => clampScale(prev + 0.25)), [clampScale]);
  const zoomOut = useCallback(() => setScale((prev) => clampScale(prev - 0.25)), [clampScale]);
  const resetZoom = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (scale <= 1) return;
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...pos };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [scale, pos]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPos({ x: posStartRef.current.x + dx, y: posStartRef.current.y + dy });
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  const onDoubleClick = useCallback(() => {
    if (scale !== 1) {
      resetZoom();
    } else {
      setScale(2);
    }
  }, [scale, resetZoom]);

  const onTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onDoubleClick();
    }
    lastTapRef.current = now;
  }, [onDoubleClick]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-stone-800/80 backdrop-blur-sm rounded-xl px-3 py-2 text-white">
        <button
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          title="縮小"
        >
          <i className="ri-zoom-out-line" />
        </button>
        <span className="text-xs font-mono min-w-[3rem] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          title="放大"
        >
          <i className="ri-zoom-in-line" />
        </button>
        <div className="w-px h-4 bg-white/20 mx-1" />
        <button
          onClick={(e) => { e.stopPropagation(); resetZoom(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          title="重置"
        >
          <i className="ri-fullscreen-line" />
        </button>
        <div className="w-px h-4 bg-white/20 mx-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          title="關閉"
        >
          <i className="ri-close-line text-lg" />
        </button>
      </div>

      {/* Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/50 text-xs flex items-center gap-3 pointer-events-none select-none">
        <span className="flex items-center gap-1">
          <i className="ri-mouse-line" />
          滾輪縮放
        </span>
        <span className="flex items-center gap-1">
          <i className="ri-drag-move-line" />
          拖拽移動
        </span>
        <span className="flex items-center gap-1">
          <i className="ri-cursor-line" />
          雙擊放大
        </span>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={onDoubleClick}
        onTouchEnd={onTap}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg select-none will-change-transform"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>
    </div>
  );
}