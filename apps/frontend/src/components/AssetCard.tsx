import { useState, useRef, useEffect } from 'react';
import { Asset, canEditAsset } from '@cx-dam/shared';
import { useAuthStore } from '../stores/auth.store';

interface AssetCardProps {
  asset: Asset & { downloadUrl: string };
  onOpenDetail: (asset: Asset & { downloadUrl: string }) => void;
  onEdit?: (asset: Asset & { downloadUrl: string }) => void;
}

type CopyFormat = 'markdown-image' | 'markdown-link' | 'url';

export function AssetCard({ asset, onOpenDetail, onEdit }: AssetCardProps) {
  const { permissions } = useAuthStore();
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<CopyFormat | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check if user can edit this asset (maintainer/admin for this workspace)
  const userPermission = permissions.find((p) => p.repoFullName === asset.workspace);
  const canEdit = userPermission && canEditAsset(userPermission.permission);

  // Debug logging
  console.log('[AssetCard] Permission check:', {
    assetWorkspace: asset.workspace,
    userPermissions: permissions,
    userPermission,
    canEdit,
    hasOnEdit: !!onEdit,
  });

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCopyMenu(false);
      }
    }

    if (showCopyMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCopyMenu]);

  // Get CloudFront URL (already provided by backend)
  const getPublicUrl = () => {
    return asset.downloadUrl;
  };

  // Check if asset is in Stage
  const isStage = asset.state === 'Stage';

  const copyToClipboard = async (format: CopyFormat) => {
    const url = getPublicUrl();
    let text = '';

    switch (format) {
      case 'markdown-image':
        // SFDocs Image Syntax format: ![SFDOCSDocs](workspace/asset_name)
        text = `![${asset.name}](${asset.workspace}/${asset.name})`;
        break;
      case 'markdown-link':
        text = `[${asset.name}](${url})`;
        break;
      case 'url':
        text = url;
        break;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(format);
      setTimeout(() => {
        setCopiedFormat(null);
        setShowCopyMenu(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    switch (fileType) {
      case 'image':
        return (
          <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
      case 'video':
        return (
          <svg className="w-12 h-12 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        );
      case 'document':
        return (
          <svg className="w-12 h-12 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      case 'archive':
        return (
          <svg className="w-12 h-12 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        );
      default:
        return (
          <svg className="w-12 h-12 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white rounded-md shadow-sm border-2 border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all group relative">
      {/* Preview Area */}
      <div className="aspect-video bg-gray-100 flex items-center justify-center relative m-3 rounded-md overflow-hidden">
        {asset.fileType === 'image' ? (
          <img
            src={asset.downloadUrl}
            alt={asset.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : asset.fileType === 'document' && asset.name.toLowerCase().endsWith('.pdf') ? (
          <div className="w-full h-full relative">
            <iframe
              src={`${asset.downloadUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full pointer-events-none"
              title={asset.name}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6">
            {getFileTypeIcon(asset.fileType)}
            <div className="mt-3 text-xs text-gray-600 uppercase font-medium tracking-wide">
              {asset.fileType}
            </div>
          </div>
        )}

        {/* Hover overlay with View Details button */}
        <div
          className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center cursor-pointer"
          onClick={() => onOpenDetail(asset)}
        >
          <button
            className="opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 px-4 py-2 bg-white rounded-md shadow-xl flex items-center gap-1.5 hover:bg-gray-50 text-sm"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="font-medium text-gray-700">View Details</span>
          </button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <h3 className="font-medium text-sm text-gray-900 truncate flex-1">
            {asset.name}
          </h3>

          {/* Edit Button - Only for Maintainer/Admin */}
          {canEdit && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(asset);
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit asset"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}

          {/* State Badge with Tooltip */}
          <div className="relative group/badge flex-shrink-0">
            <span
              className={`px-2 py-1 text-xs font-semibold rounded cursor-help ${
                isStage
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                  : 'bg-green-100 text-green-800 border border-green-300'
              }`}
            >
              {isStage ? 'STAGE' : 'PROD'}
            </span>

            {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 w-56 opacity-0 invisible group-hover/badge:opacity-100 group-hover/badge:visible transition-all duration-200 z-30">
              <div className="bg-gray-900 text-white text-[11px] rounded-md p-2.5 shadow-xl">
                <div className="font-semibold mb-1">
                  {isStage ? '🔧 Development Mode' : '✅ Production'}
                </div>
                <p className="text-gray-300 leading-snug">
                  {isStage
                    ? 'This asset is in development mode and will move to production when the PR using this asset is merged to the prod/default branch.'
                    : 'This asset is live in production and available for public use.'}
                </p>
                {/* Arrow */}
                <div className="absolute top-full right-4 -mt-1">
                  <div className="w-2 h-2 bg-gray-900 transform rotate-45"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 truncate mb-2">{asset.workspace}</p>

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
          <span className="uppercase font-semibold">{asset.fileType}</span>
          <span className="font-medium">{(asset.size / 1024).toFixed(0)} KB</span>
        </div>

        {/* Copy Button - Inside Card */}
        <div className="mt-2 relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCopyMenu(!showCopyMenu);
            }}
            className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded transition-colors flex items-center justify-center gap-1.5 text-sm font-medium border border-gray-200"
            title="Copy URL"
          >
            {copiedFormat ? (
              <>
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy URL</span>
              </>
            )}
          </button>

          {/* Copy Dropdown */}
          {showCopyMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-white rounded-md shadow-xl border border-gray-200 py-1 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard('markdown-image');
                }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between group"
              >
                <span className="text-gray-700">SFDocs Image Syntax</span>
                <code className="text-[10px] text-gray-400 group-hover:text-gray-600">![Title](path)</code>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard('markdown-link');
                }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between group"
              >
                <span className="text-gray-700">Markdown Link</span>
                <code className="text-[10px] text-gray-400 group-hover:text-gray-600">[](url)</code>
              </button>
              <div className="border-t border-gray-100 my-0.5"></div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard('url');
                }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center justify-between group"
              >
                <span className="text-gray-700">Plain URL</span>
                <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Tags - Collapsible (Below Copy URL) */}
        <div className="mt-2">
          {asset.tags.length > 0 ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllTags(!showAllTags);
                }}
                className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 mb-1 transition-colors font-medium"
              >
                <svg
                  className={`w-2.5 h-2.5 transition-transform ${showAllTags ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">
                  Tags {!showAllTags && `(${asset.tags.length})`}
                </span>
              </button>

              <div
                className={`transition-all duration-200 overflow-hidden ${
                  showAllTags ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="flex flex-wrap gap-1">
                  {asset.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 italic">No tags available</p>
          )}
        </div>
      </div>
    </div>
  );
}
