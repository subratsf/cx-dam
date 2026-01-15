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
          className="relative bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 max-h-[90vh] overflow-y-auto">
            {/* Left: Preview */}
            <div className="bg-gray-50 flex items-center justify-center p-8 min-h-[400px] lg:min-h-[600px]">
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

            {/* Right: Details */}
            <div className="p-8 overflow-y-auto">
              {/* Title & State Badge */}
              <div className="mb-6">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-2xl font-semibold text-gray-900 break-words flex-1">
                    {asset.name}
                  </h2>
                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full flex-shrink-0 ${
                      isStage
                        ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                        : 'bg-green-100 text-green-800 border border-green-300'
                    }`}
                  >
                    {isStage ? 'STAGE' : 'PRODUCTION'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {isStage
                    ? 'This asset will move to production when the PR is merged to the default branch'
                    : 'This asset is live in production'}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="space-y-4 mb-6">
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    Asset Information
                  </h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Workspace</dt>
                      <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded">
                        {asset.workspace}
                      </dd>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">File Type</dt>
                        <dd className="mt-1 text-sm text-gray-900 uppercase font-semibold">
                          {asset.fileType}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Size</dt>
                        <dd className="mt-1 text-sm text-gray-900 font-semibold">
                          {(asset.size / 1024).toFixed(2)} KB
                        </dd>
                      </div>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Created</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {formatDate(asset.createdAt)}
                      </dd>
                    </div>

                    {asset.updatedAt !== asset.createdAt && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Last Modified</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {formatDate(asset.updatedAt)}
                        </dd>
                      </div>
                    )}

                    <div>
                      <dt className="text-sm font-medium text-gray-500">Asset ID</dt>
                      <dd className="mt-1 text-xs text-gray-600 font-mono bg-gray-50 px-3 py-2 rounded break-all">
                        {asset.id}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Tags */}
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    Tags
                  </h3>
                  {asset.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {asset.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No tags</p>
                  )}
                </div>
              </div>

              {/* Copy URL Options */}
              <div className="border-t border-gray-200 pt-6 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Copy URL
                </h3>

                <button
                  onClick={() => copyToClipboard('markdown-image', `![${asset.name}](${asset.downloadUrl})`)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Markdown Image</div>
                      <code className="text-xs text-gray-500 mt-1 block">![alt](url)</code>
                    </div>
                    {copiedFormat === 'markdown-image' ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => copyToClipboard('markdown-link', `[${asset.name}](${asset.downloadUrl})`)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Markdown Link</div>
                      <code className="text-xs text-gray-500 mt-1 block">[text](url)</code>
                    </div>
                    {copiedFormat === 'markdown-link' ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => copyToClipboard('html-image', `<img src="${asset.downloadUrl}" alt="${asset.name}" />`)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">HTML Image</div>
                      <code className="text-xs text-gray-500 mt-1 block">&lt;img src="url" /&gt;</code>
                    </div>
                    {copiedFormat === 'html-image' ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => copyToClipboard('html-anchor', `<a href="${asset.downloadUrl}">${asset.name}</a>`)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">HTML Link</div>
                      <code className="text-xs text-gray-500 mt-1 block">&lt;a href="url"&gt;text&lt;/a&gt;</code>
                    </div>
                    {copiedFormat === 'html-anchor' ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => copyToClipboard('url', asset.downloadUrl)}
                  className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-blue-900">Plain URL</div>
                      <code className="text-xs text-blue-700 mt-1 block truncate max-w-md">
                        {asset.downloadUrl}
                      </code>
                    </div>
                    {copiedFormat === 'url' ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-blue-600 group-hover:text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-gray-200 pt-6 mt-6 flex gap-3">
                <a
                  href={asset.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-center font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Tab
                </a>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
