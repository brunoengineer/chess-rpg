import type { ReactNode } from 'react';
import { useT } from '../i18n';

export function Modal({ children, onClose, className = '' }: { children: ReactNode; onClose?: () => void; className?: string }) {
  const t = useT();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal panel ${className}`} onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button className="modal-close" onClick={onClose} aria-label={t.common.close}>
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
