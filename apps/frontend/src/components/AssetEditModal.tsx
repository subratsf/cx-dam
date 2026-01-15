import { useState, useRef, useEffect } from 'react';
import { Asset } from '@cx-dam/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetApi } from '../api/asset.api';

interface AssetEditModalProps {
  asset: Asset & { downloadUrl: string };
  isOpen: boolean;
  onClose: () => void;
  onReplaceStart?: () => void;
  onReplaceComplete?: () => void;
}

type EditTab = 'metadata' | 'replace';

export function AssetEditModal({ asset, isOpen, onClose, onReplaceStart, onReplaceComplete }: AssetEditModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<EditTab>('metadata');
  const [name, setName] = useState(asset.name);
  const [tags, setTags] = useState(asset.tags.join(', '));
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when asset changes
  useEffect(() => {
    setName(asset.name);
    setTags(asset.tags.join(', '));
    setReplaceFile(null);
    setActiveTab('metadata');
  }, [asset]);

  // Update metadata mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const tagsArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      return assetApi.updateAsset(asset.id, {
        name: name !== asset.name ? name : undefined,
        tags: tagsArray,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      onClose();
    },
  });

  // Replace file mutation
  const replaceMutation = useMutation({
    mutationFn: async () => {
      if (!replaceFile) throw new Error('No file selected');
      onReplaceStart?.();
      return assetApi.replaceAsset(asset.id, replaceFile);
    },
    onSuccess: async () => {
      // Full page refresh to get fresh data with latest asset details and preview
      window.location.reload();
    },
    onError: () => {
      onReplaceComplete?.();
    },
  });

  const handleUpdate = () => {
    updateMutation.mutate();
  };

  const handleReplace = () => {
    if (replaceFile) {
      replaceMutation.mutate();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit Asset</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            onClick={() => setActiveTab('metadata')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'metadata'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Update Metadata
          </button>
          <button
            onClick={() => setActiveTab('replace')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'replace'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Replace File
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Metadata Tab */}
          {activeTab === 'metadata' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asset Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter asset name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter comma-separated tags"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Separate multiple tags with commas
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Asset Info</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Workspace:</span> {asset.workspace}</p>
                  <p><span className="font-medium">Type:</span> {asset.fileType}</p>
                  <p><span className="font-medium">Size:</span> {(asset.size / 1024).toFixed(2)} KB</p>
                  <p><span className="font-medium">State:</span> {asset.state}</p>
                </div>
              </div>

              {updateMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  {updateMutation.error instanceof Error
                    ? updateMutation.error.message
                    : 'Failed to update asset'}
                </div>
              )}
            </div>
          )}

          {/* Replace File Tab */}
          {activeTab === 'replace' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <h4 className="text-sm font-medium text-yellow-900 mb-1">
                      Replace Existing File
                    </h4>
                    <p className="text-sm text-yellow-800">
                      This will replace the file in S3 and update the metadata. The asset URL will remain the same.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select New File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                {replaceFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: <span className="font-medium">{replaceFile.name}</span> ({(replaceFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Current File</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Name:</span> {asset.name}</p>
                  <p><span className="font-medium">Type:</span> {asset.fileType}</p>
                  <p><span className="font-medium">Size:</span> {(asset.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>

              {replaceMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                  {replaceMutation.error instanceof Error
                    ? replaceMutation.error.message
                    : 'Failed to replace file'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>

          {activeTab === 'metadata' && (
            <button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || (!name.trim() && !tags.trim())}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {updateMutation.isPending ? 'Updating...' : 'Update Metadata'}
            </button>
          )}

          {activeTab === 'replace' && (
            <button
              onClick={handleReplace}
              disabled={replaceMutation.isPending || !replaceFile}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {replaceMutation.isPending ? 'Replacing...' : 'Replace File'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
