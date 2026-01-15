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
          className="relative bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 hover:bg-white shadow-lg transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Top: Preview (70% height) */}
          <div className="bg-gray-50 flex items-center justify-center p-8" style={{ minHeight: '70vh' }}>
              {asset.fileType === 'image' ? (
                <img
                  src={asset.downloadUrl}
                  alt={asset.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : asset.fileType === 'document' && asset.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={asset.downloadUrl}
                  className="w-full h-full min-h-[500px]"
                  title={asset.name}
                />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  {getFileTypeIcon(asset.fileType)}
                  <p className="mt-4 text-lg text-gray-600 uppercase font-semibold tracking-wide">
                    {asset.fileType}
                  </p>
                </div>
              )}
          </div>

          {/* Bottom: Details (30% height, scrollable) */}
          <div className="p-4 overflow-y-auto bg-white" style={{ maxHeight: '30vh' }}>
              {/* Title & State Badge */}
              <div className="mb-3">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 className="text-xl font-semibold text-gray-900 break-words flex-1">
                    {asset.name}
                  </h2>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded-full flex-shrink-0 ${
                      isStage
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                        : 'bg-green-100 text-green-800 border border-green-300'
                    }`}
                  >
                    {isStage ? 'STAGE' : 'PRODUCTION'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {isStage
                    ? 'This asset will move to production when the PR is merged to the default branch'
                    : 'This asset is live in production'}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="space-y-3 mb-3">
                <div className="border-t border-gray-200 pt-2">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Asset Information
                  </h3>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Workspace</dt>
                      <dd className="mt-0.5 text-xs text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                        {asset.workspace}
                      </dd>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">File Type</dt>
                        <dd className="mt-0.5 text-xs text-gray-900 uppercase font-semibold">
                          {asset.fileType}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Size</dt>
                        <dd className="mt-0.5 text-xs text-gray-900 font-semibold">
                          {(asset.size / 1024).toFixed(2)} KB
                        </dd>
                      </div>
                    </div>

                    <div>
                      <dt className="text-xs font-medium text-gray-500">Created</dt>
                      <dd className="mt-0.5 text-xs text-gray-900">
                        {formatDate(asset.createdAt)}
                      </dd>
                    </div>

                    {asset.updatedAt !== asset.createdAt && (
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Last Modified</dt>
                        <dd className="mt-0.5 text-xs text-gray-900">
                          {formatDate(asset.updatedAt)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Tags */}
                <div className="border-t border-gray-200 pt-2">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                    Tags
                  </h3>
                  {asset.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {asset.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No tags</p>
                  )}
                </div>
              </div>

              {/* Copy URL Options */}
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Copy URL
                </h3>

                <button
                  onClick={() => copyToClipboard('markdown-image', `![${asset.name}](${asset.downloadUrl})`)}
                  className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-gray-900">Markdown Image</div>
                      <code className="text-[10px] text-gray-500 mt-0.5 block">![alt](url)</code>
                    </div>
                    {copiedFormat === 'markdown-image' ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => copyToClipboard('markdown-link', `[${asset.name}](${asset.downloadUrl})`)}
                  className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-gray-900">Markdown Link</div>
                      <code className="text-[10px] text-gray-500 mt-0.5 block">[text](url)</code>
                    </div>
                    {copiedFormat === 'markdown-link' ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => copyToClipboard('html-image', `<img src="${asset.downloadUrl}" alt="${asset.name}" />`)}
                  className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-gray-900">HTML Image</div>
                      <code className="text-[10px] text-gray-500 mt-0.5 block">&lt;img src="url" /&gt;</code>
                    </div>
                    {copiedFormat === 'html-image' ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => copyToClipboard('html-anchor', `<a href="${asset.downloadUrl}">${asset.name}</a>`)}
                  className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-gray-900">HTML Link</div>
                      <code className="text-[10px] text-gray-500 mt-0.5 block">&lt;a href="url"&gt;text&lt;/a&gt;</code>
                    </div>
                    {copiedFormat === 'html-anchor' ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => copyToClipboard('url', asset.downloadUrl)}
                  className="w-full px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-blue-900">Plain URL</div>
                      <code className="text-[10px] text-blue-700 mt-0.5 block truncate">
                        {asset.downloadUrl}
                      </code>
                    </div>
                    <div className="flex-shrink-0">
                      {copiedFormat === 'url' ? (
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-blue-600 group-hover:text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-200 pt-4 mt-4 flex gap-3">
                <a
                  href={asset.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Tab
                </a>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                >
                  Close
                </button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
