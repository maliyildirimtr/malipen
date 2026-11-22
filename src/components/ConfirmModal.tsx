import React, { useEffect } from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app confirmation (a native dialog would fight the always-on-top overlay). */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onConfirm, onCancel]);

  return (
    <div className="confirm-modal-overlay" onMouseDown={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onCancel(); }}>
      <div className="confirm-modal" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn-primary" autoFocus onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};
