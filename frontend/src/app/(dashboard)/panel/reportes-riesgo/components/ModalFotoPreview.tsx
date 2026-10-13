"use client";

interface ModalFotoPreviewProps {
  url: string | null;
  onClose: () => void;
}

export function ModalFotoPreview({ url, onClose }: ModalFotoPreviewProps) {
  if (!url) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh]">
        <img
          src={url}
          alt="Evidencia fotográfica completa"
          className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-slate-700"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-2 text-sm cursor-pointer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
