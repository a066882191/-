import { useEffect, useRef } from 'react';

interface DrivePreviewModalProps {
  src: string;
  title: string;
  onClose: () => void;
}

export default function DrivePreviewModal({ src, title, onClose }: DrivePreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex flex-col animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-900/90 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <i className="ri-file-pdf-line text-white text-sm" />
          </div>
          <span className="text-sm text-white/90 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors whitespace-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="ri-external-link-line" />
            在新視窗開啟
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white"
            title="關閉"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>
      </div>

      {/* PDF iframe */}
      <div
        className="flex-1 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          ref={iframeRef}
          src={src}
          title={title}
          className="w-full h-full border-0"
          allow="fullscreen"
        />
      </div>

      {/* Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/40 text-xs flex items-center gap-3 pointer-events-none select-none">
        <span className="flex items-center gap-1">
          <i className="ri-arrow-left-right-line" />
          左右滑動翻頁
        </span>
        <span className="flex items-center gap-1">
          <i className="ri-fullscreen-line" />
          支援全螢幕
        </span>
      </div>
    </div>
  );
}