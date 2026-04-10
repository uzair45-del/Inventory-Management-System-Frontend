import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

// 1. Toast Helpers for Alerts
export const notifySuccess = (message) => toast.success(message);
export const notifyError = (message) => toast.error(message);
export const notifyInfo = (message) => toast(message, { icon: 'ℹ️' });

// 2. Custom Confirm Modal
// Usage: const confirmed = await confirmAction("Are you sure?");
export const confirmAction = async (title, text = "This cannot be undone.") => {
  const result = await Swal.fire({
    title: title,
    text: text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6', // matches primary
    cancelButtonColor: '#ef4444',  // matches danger
    confirmButtonText: 'Yes, proceed',
    cancelButtonText: 'No, cancel',
    background: 'var(--card-bg)',
    color: 'var(--text-main)',
    backdrop: `rgba(0,0,0,0.5)`,
    customClass: {
      popup: 'glass-panel',
      title: 'modal-title',
      cancelButton: 'btn-danger',
      confirmButton: 'btn-primary'
    }
  });

  return result.isConfirmed;
};

// 3. Manual Close Modals (Requires user to click OK)
export const alertSuccess = (title, text) => {
  return Swal.fire({
    title: title,
    text: text,
    icon: 'success',
    confirmButtonColor: '#3b82f6',
    confirmButtonText: 'OK',
    background: 'var(--card-bg)',
    color: 'var(--text-main)',
    backdrop: `rgba(0,0,0,0.5)`,
    customClass: {
      popup: 'glass-panel',
      title: 'modal-title',
      confirmButton: 'btn-primary'
    }
  });
};

export const alertError = (title, text) => {
  return Swal.fire({
    title: title,
    text: text,
    icon: 'error',
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'OK',
    background: 'var(--card-bg)',
    color: 'var(--text-main)',
    backdrop: `rgba(0,0,0,0.5)`,
    customClass: {
      popup: 'glass-panel',
      title: 'modal-title',
      confirmButton: 'btn-danger'
    }
  });
};
