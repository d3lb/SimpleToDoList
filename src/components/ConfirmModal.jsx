import { useEffect } from "react";

function ConfirmModal({
  open,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div className="modalOverlay" onMouseDown={onCancel}>
      <div className="modalBox" onMouseDown={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>

        <div className="modalActions">
          <button className="modalBtn" onClick={onCancel}>{cancelText}</button>
          <button className={danger ? "modalBtn dangerModalBtn" : "modalBtn confirmModalBtn"} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;