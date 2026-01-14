import { useEffect } from 'react';

export type ToastType = 'success' | 'error';

interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
  autoClose?: boolean;
}

export function Toast({ type, message, onClose, autoClose = true }: ToastProps) {
  useEffect(() => {
    if (autoClose && type === 'success') {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoClose, type, onClose]);

  const isSuccess = type === 'success';

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60] animate-slideDown">
      <div
        className={`flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl border-2 min-w-[400px] ${
          isSuccess
            ? 'bg-green-50 border-green-500'
            : 'bg-red-50 border-red-500'
        }`}
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {isSuccess ? (
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>

        {/* Message */}
        <p
          className={`flex-1 text-sm font-medium ${
            isSuccess ? 'text-green-900' : 'text-red-900'
          }`}
        >
          {message}
        </p>

        {/* Close button (only show for errors) */}
        {!isSuccess && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-red-600 hover:text-red-800 transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
