import { useEffect } from 'react';
import DashboardSection from '../../pages/dashboards/components/DashboardSection.jsx';
import '../../pages/dashboards/Dashboard.css';

const ConfirmationModal = ({
  open = false,
  title = 'Confirm action',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  isBusy = false,
  onConfirm = () => {},
  onCancel = () => {},
}) => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusy) {
        onCancel();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBusy, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="dashboard-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onCancel();
        }
      }}
    >
      <div className="dashboard-overlay__panel confirmation-modal-shell">
        <DashboardSection
          title={title}
          className="dashboard-section--overlay confirmation-modal"
          action={(
            <button
              type="button"
              className="ghost-button"
              onClick={onCancel}
              disabled={isBusy}
            >
              {cancelLabel}
            </button>
          )}
        >
          <div className="confirmation-modal__body">
            <p>{message}</p>
            <div className="confirmation-modal__actions">
              <button
                type="button"
                className="ghost-button"
                onClick={onCancel}
                disabled={isBusy}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={`confirmation-modal__confirm confirmation-modal__confirm--${tone}`}
                onClick={onConfirm}
                disabled={isBusy}
              >
                {isBusy ? 'Working...' : confirmLabel}
              </button>
            </div>
          </div>
        </DashboardSection>
      </div>
    </div>
  );
};

export default ConfirmationModal;
