import { useEffect, useState } from 'react';
import { Asset } from '@cx-dam/shared';

interface AssetDetailModalProps {
  asset: Asset & { downloadUrl: string };
  isOpen: boolean;
  onClose: () => void;
}

export function AssetDetailModal({ asset, isOpen, onClose }: AssetDetailModalProps) {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isStage = asset.state === 'Stage';

  const copyToClipboard = async (format: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileTypeIcon = (fileType: string) => {
    const iconClass = "w-16 h-16";
    switch (fileType) {
      case 'image':
        return (
          <svg className={`${iconClass} text-blue-500`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
      case 'video':
        return (
          <svg className={`${iconClass} text-purple-500`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        );
      case 'document':
        return (
          <svg className={`${iconClass} text-red-500`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      case 'archive':
        return (
          <svg className={`${iconClass} text-yellow-500`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        );
      default:
        return (
          <svg className={`${iconClass} text-gray-500`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Title and Close */}
          <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  {asset.name}
                </h2>
                <span
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${
                    isStage
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {isStage ? 'STAGE' : 'PROD'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Close (Esc)"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 80px)' }}>
            {/* Left: Image Preview (2/3 width) */}
            <div className="lg:col-span-2">
              <div className="bg-gray-50 rounded-lg flex items-center justify-center p-12 min-h-[500px]">
                {asset.fileType === 'image' ? (
                  <img
                    src={asset.downloadUrl}
                    alt={asset.name}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                ) : asset.fileType === 'document' && asset.name.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={asset.downloadUrl}
                    className="w-full h-full min-h-[600px] rounded"
                    title={asset.name}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    {getFileTypeIcon(asset.fileType)}
                    <p className="mt-4 text-sm uppercase font-medium tracking-wide">
                      {asset.fileType}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Details Sidebar (1/3 width) */}
            <div className="lg:col-span-1 space-y-5">
              {/* Info Box */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <p className="text-xs text-gray-500">
                  {isStage
                    ? 'This asset will move to production when the PR is merged'
                    : 'This asset is live in production'}
                </p>

                <div className="space-y-2.5">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 mb-1">Workspace</dt>
                    <dd className="text-sm text-gray-900 font-mono bg-white px-3 py-2 rounded border border-gray-200">
                      {asset.workspace}
                    </dd>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs font-medium text-gray-500 mb-1">Type</dt>
                      <dd className="text-sm text-gray-900 uppercase font-semibold">
                        {asset.fileType}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-gray-500 mb-1">Size</dt>
                      <dd className="text-sm text-gray-900 font-semibold">
                        {(asset.size / 1024).toFixed(1)} KB
                      </dd>
                    </div>
                  </div>

                  <div>
                    <dt className="text-xs font-medium text-gray-500 mb-1">Created</dt>
                    <dd className="text-sm text-gray-900">
                      {formatDate(asset.createdAt)}
                    </dd>
                  </div>

                  {asset.updatedAt !== asset.createdAt && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500 mb-1">Modified</dt>
                      <dd className="text-sm text-gray-900">
                        {formatDate(asset.updatedAt)}
                      </dd>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {asset.tags.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {asset.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-md font-medium border border-blue-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy URL Section */}
              <div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Copy URL
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() => copyToClipboard('url', asset.downloadUrl)}
                    className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm flex items-center justify-between group"
                  >
                    <span>Copy Direct URL</span>
                    {copiedFormat === 'url' ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => copyToClipboard('markdown-image', `![${asset.name}](${asset.downloadUrl})`)}
                    className="w-full px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors font-medium text-sm flex items-center justify-between text-gray-700 group"
                  >
                    <span>Markdown Image</span>
                    {copiedFormat === 'markdown-image' ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => copyToClipboard('html-image', `<img src="${asset.downloadUrl}" alt="${asset.name}" />`)}
                    className="w-full px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors font-medium text-sm flex items-center justify-between text-gray-700 group"
                  >
                    <span>HTML Image</span>
                    {copiedFormat === 'html-image' ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200">
                <a
                  href={asset.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Tab
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
