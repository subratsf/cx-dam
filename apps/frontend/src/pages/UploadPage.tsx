import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { assetApi } from '../api/asset.api';
import { useAuthStore } from '../stores/auth.store';
import { canUploadAsset } from '@cx-dam/shared';

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileUpload {
  id: string;
  file: File;
  name: string;
  workspace: string;
  tags: string[]; // Per-asset specific tags
  status: UploadStatus;
  progress: number;
  error?: string;
  isValidating?: boolean;
  isDuplicate?: boolean;
}

// Helper function to split filename into base name and extension
const splitFileName = (filename: string): { baseName: string; extension: string } => {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return { baseName: filename, extension: '' };
  }
  return {
    baseName: filename.substring(0, lastDotIndex),
    extension: filename.substring(lastDotIndex), // includes the dot
  };
};

// Helper function to get file type from extension
const getFileType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return 'image';
  // Videos
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext)) return 'video';
  // Documents
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'document';
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';

  return 'other';
};

// Helper function to get icon based on file type
const getFileTypeIcon = (type: string) => {
  switch (type) {
    case 'image':
      return (
        <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    case 'video':
      return (
        <svg className="h-5 w-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
        </svg>
      );
    case 'document':
      return (
        <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      );
    case 'archive':
      return (
        <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      );
    default:
      return (
        <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
  }
};

export function UploadPage() {
  const { permissions } = useAuthStore();
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [commonTags, setCommonTags] = useState('');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const validationTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const uploadableRepos = permissions.filter((p) => canUploadAsset(p.permission));

  // Function to validate asset name uniqueness
  const validateAssetName = async (id: string, name: string, workspace: string) => {
    if (!name.trim() || !workspace) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, isValidating: false, isDuplicate: false } : f
        )
      );
      return;
    }

    try {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, isValidating: true } : f))
      );

      const { isUnique } = await assetApi.validateName(name, workspace);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                isValidating: false,
                isDuplicate: !isUnique,
                error: !isUnique
                  ? 'An asset with this name already exists in this workspace. Please rename to upload.'
                  : undefined,
              }
            : f
        )
      );
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, isValidating: false, isDuplicate: false } : f
        )
      );
    }
  };

  // Function to update file name with debounced validation (preserves extension)
  const updateFileName = (id: string, newBaseName: string) => {
    // Get the current file to extract its extension
    const currentFile = files.find((f) => f.id === id);
    if (!currentFile) return;

    const { extension } = splitFileName(currentFile.name);
    const fullName = newBaseName + extension;

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: fullName, error: undefined } : f))
    );

    // Clear existing timer for this file
    if (validationTimers.current[id]) {
      clearTimeout(validationTimers.current[id]);
    }

    // Set new timer for validation (debounce 500ms)
    validationTimers.current[id] = setTimeout(() => {
      validateAssetName(id, fullName, currentFile.workspace);
    }, 500);
  };

  // Function to update per-asset tags
  const updateFileTags = (id: string, tagsString: string) => {
    const tagsArray = tagsString
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, tags: tagsArray } : f))
    );
  };

  // Filter repos based on search
  const filteredRepos = uploadableRepos.filter((repo) =>
    repo.repoFullName.toLowerCase().includes(workspaceSearch.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
        setShowWorkspaceDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle workspace selection
  const handleWorkspaceSelect = (repoFullName: string) => {
    setSelectedWorkspace(repoFullName);
    setWorkspaceSearch(repoFullName);
    setShowWorkspaceDropdown(false);
  };

  const uploadMutation = useMutation({
    mutationFn: async (fileUpload: FileUpload) => {
      console.log('[Upload Flow] Starting upload for', fileUpload.name);

      // Combine common tags with per-asset tags
      const commonTagsArray = commonTags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const allTags = [...new Set([...commonTagsArray, ...fileUpload.tags])]; // Remove duplicates

      try {
        // Step 1: Request upload URL and create DB record
        console.log('[Upload Flow] Step 1: Requesting upload URL');
        const { uploadUrl, assetId } = await assetApi.requestUploadUrl({
          name: fileUpload.name,
          workspace: fileUpload.workspace,
          tags: allTags,
          mimeType: fileUpload.file.type,
          size: fileUpload.file.size,
        });
        console.log('[Upload Flow] Step 1 Complete: Got assetId', assetId);

        // Update progress
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileUpload.id ? { ...f, progress: 50 } : f
          )
        );

        // Step 2: Upload to S3
        console.log('[Upload Flow] Step 2: Uploading to S3');
        await assetApi.uploadToS3(uploadUrl, fileUpload.file);
        console.log('[Upload Flow] Step 2 Complete: S3 upload finished');

        // Update progress
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileUpload.id ? { ...f, progress: 75 } : f
          )
        );

        // Step 3: Confirm upload completion
        console.log('[Upload Flow] Step 3: Confirming upload');
        await assetApi.confirmUpload(assetId);
        console.log('[Upload Flow] Step 3 Complete: Upload confirmed');

        // Update to 100%
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileUpload.id ? { ...f, progress: 100 } : f
          )
        );

        console.log('[Upload Flow] ✅ Complete success for', fileUpload.name);
      } catch (error: any) {
        console.error('[Upload Flow] ❌ Failed at some step:', {
          fileName: fileUpload.name,
          error: error.message,
          errorResponse: error.response?.data,
        });

        // If upload failed, cleanup any orphaned DB record
        console.log('[Upload Flow] Cleaning up orphaned record due to upload failure');
        try {
          await assetApi.cleanupOrphanedByName(fileUpload.name, fileUpload.workspace);
        } catch (cleanupError) {
          console.error('[Upload Flow] Cleanup failed (non-fatal)', cleanupError);
        }

        throw error;
      }
    },
    onSuccess: (_, fileUpload) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileUpload.id ? { ...f, status: 'success' } : f
        )
      );
    },
    onError: (error: any, fileUpload) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileUpload.id
            ? {
                ...f,
                status: 'error',
                error: error.response?.data?.error?.message || 'Upload failed',
              }
            : f
        )
      );
    },
  });

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    // Only allow file selection if workspace is selected
    if (!selectedWorkspace) return;

    // Check if adding these files would exceed the limit
    const currentPendingCount = files.filter((f) => f.status !== 'success').length;
    const filesArray = Array.from(fileList);
    const maxAllowed = 10 - currentPendingCount;

    if (filesArray.length > maxAllowed) {
      alert(`You can only upload up to 10 assets at a time. Currently ${currentPendingCount} assets in queue. You can add ${maxAllowed} more.`);
      return;
    }

    const newFiles: FileUpload[] = filesArray.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      workspace: selectedWorkspace,
      tags: [], // Start with empty per-asset tags
      status: 'pending' as UploadStatus,
      progress: 0,
      isValidating: false,
      isDuplicate: false,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Validate each file name
    newFiles.forEach((file) => {
      validateAssetName(file.id, file.name, file.workspace);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startUpload = async (fileUpload: FileUpload) => {
    // If this is a retry, first cleanup any orphaned record
    if (fileUpload.status === 'error') {
      console.log('[Upload Flow] Retrying upload - cleaning up orphaned record first');
      try {
        await assetApi.cleanupOrphanedByName(fileUpload.name, fileUpload.workspace);
      } catch (cleanupError) {
        console.error('[Upload Flow] Pre-upload cleanup failed (non-fatal)', cleanupError);
      }
    }

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileUpload.id ? { ...f, status: 'uploading', error: undefined } : f
      )
    );
    uploadMutation.mutate(fileUpload);
  };

  const uploadAll = () => {
    files
      .filter((f) => (f.status === 'pending' || f.status === 'error') && !f.isDuplicate)
      .forEach((f) => startUpload(f));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles((prev) => prev.filter((f) => f.status !== 'success'));
  };

  if (uploadableRepos.length === 0) {
    return (
      <div className="h-[calc(100vh-80px)] flex items-center justify-center max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-8 shadow-lg">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-yellow-900 mb-3">
                No Upload Permissions
              </h2>
              <div className="space-y-3 text-yellow-800">
                <p>
                  You need <span className="font-semibold">write access</span> or higher to at
                  least one repository in the{' '}
                  <span className="font-mono bg-yellow-100 px-2 py-0.5 rounded">
                    salesforcedocs
                  </span>{' '}
                  organization to upload assets.
                </p>
                <div className="bg-white/60 rounded-lg p-4 mt-4">
                  <p className="font-medium text-yellow-900 mb-2">Required permissions:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>
                      <span className="font-semibold">Write</span> - Can upload new assets
                    </li>
                    <li>
                      <span className="font-semibold">Maintain</span> - Can upload and replace
                      assets
                    </li>
                    <li>
                      <span className="font-semibold">Admin</span> - Full access
                    </li>
                  </ul>
                </div>
                <p className="text-sm mt-4">
                  💡 <span className="font-medium">Need access?</span> Contact your GitHub
                  organization administrator to request write permissions to a repository.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = files.filter((f) => f.status === 'pending' && !f.isDuplicate).length;
  const duplicateCount = files.filter((f) => f.isDuplicate).length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error' && !f.isDuplicate).length;
  const currentQueueCount = files.filter((f) => f.status !== 'success').length;
  const canAddMore = currentQueueCount < 10;

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden flex flex-col w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-normal text-gray-700">Upload files</h1>
      </div>

      {/* Upload settings */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div ref={workspaceDropdownRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workspace (Repository) *
            </label>
            <div className="relative">
              <input
                type="text"
                value={workspaceSearch}
                onChange={(e) => {
                  setWorkspaceSearch(e.target.value);
                  setShowWorkspaceDropdown(true);
                  if (!e.target.value) {
                    setSelectedWorkspace('');
                  }
                }}
                onFocus={() => setShowWorkspaceDropdown(true)}
                placeholder="Search and select a repository..."
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Dropdown list */}
            {showWorkspaceDropdown && filteredRepos.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.repoFullName}
                    type="button"
                    onClick={() => handleWorkspaceSelect(repo.repoFullName)}
                    className={`w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors ${
                      selectedWorkspace === repo.repoFullName
                        ? 'bg-blue-100 text-blue-900 font-medium'
                        : 'text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{repo.repoFullName}</span>
                      {selectedWorkspace === repo.repoFullName && (
                        <svg
                          className="h-5 w-5 text-blue-600 flex-shrink-0 ml-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results message */}
            {showWorkspaceDropdown && workspaceSearch && filteredRepos.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg p-4 text-center text-gray-500 text-sm">
                No repositories found matching "{workspaceSearch}"
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Common Tags (applied to all assets)
            </label>
            <input
              type="text"
              value={commonTags}
              onChange={(e) => setCommonTags(e.target.value)}
              placeholder="e.g., documentation, screenshot (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter comma-separated tags that will be applied to all uploaded assets
            </p>
          </div>
        </div>
      </div>

      {/* Drag & Drop area */}
      <div
        onDragOver={selectedWorkspace && canAddMore ? handleDragOver : undefined}
        onDragLeave={selectedWorkspace && canAddMore ? handleDragLeave : undefined}
        onDrop={selectedWorkspace && canAddMore ? handleDrop : undefined}
        className={`bg-white rounded-lg shadow border-2 border-dashed transition-colors p-8 text-center mb-6 flex-shrink-0 ${
          !selectedWorkspace || !canAddMore
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          disabled={!selectedWorkspace || !canAddMore}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={!selectedWorkspace || !canAddMore ? 'cursor-not-allowed' : 'cursor-pointer'}
        >
          <svg
            className={`mx-auto h-16 w-16 ${!selectedWorkspace || !canAddMore ? 'text-gray-300' : 'text-gray-400'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          {!selectedWorkspace ? (
            <div className="mt-4">
              <p className="text-base text-gray-400 font-medium">Please select a workspace first</p>
              <p className="text-sm text-gray-400">Choose a repository above to enable file uploads</p>
            </div>
          ) : !canAddMore ? (
            <div className="mt-4">
              <p className="text-base text-gray-400 font-medium">Upload limit reached</p>
              <p className="text-sm text-gray-400">Maximum 10 assets at a time. Clear completed uploads to add more.</p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center">
              <p className="text-base text-gray-700 font-medium">
                {isDragging ? 'Drop files here' : 'Drag and drop files here'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {currentQueueCount > 0 ? `${currentQueueCount}/10 assets in queue` : 'Maximum 10 assets at a time'}
              </p>
              <span className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
                Select files
              </span>
            </div>
          )}
        </label>
      </div>

      {/* Action buttons */}
      {files.length > 0 && (
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {files.length} file{files.length !== 1 ? 's' : ''} {files.filter((f) => f.status !== 'success').length > 10 ? '(max 10)' : ''} •{' '}
            {successCount > 0 && (
              <span className="text-green-600">{successCount} completed</span>
            )}
            {successCount > 0 && (uploadingCount > 0 || pendingCount > 0) && ' • '}
            {uploadingCount > 0 && (
              <span className="text-blue-600">{uploadingCount} uploading</span>
            )}
            {(uploadingCount > 0 || successCount > 0) && pendingCount > 0 && ' • '}
            {pendingCount > 0 && (
              <span className="text-gray-600">{pendingCount} pending</span>
            )}
            {errorCount > 0 && (
              <>
                {' • '}
                <span className="text-red-600">{errorCount} failed</span>
              </>
            )}
            {duplicateCount > 0 && (
              <>
                {' • '}
                <span className="text-orange-600">{duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {successCount > 0 && (
              <button
                onClick={clearCompleted}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear completed
              </button>
            )}
            {pendingCount > 0 && (
              <button
                onClick={uploadAll}
                disabled={!selectedWorkspace || uploadMutation.isPending}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {uploadingCount > 0 ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Uploading...
                  </span>
                ) : (
                  `Upload All (${pendingCount})`
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Files list */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 divide-y divide-gray-200 overflow-y-auto min-h-0">
          {files.map((fileUpload) => {
            const { baseName, extension } = splitFileName(fileUpload.name);
            return (
            <div key={fileUpload.id} className="p-4 hover:bg-gray-50 transition-colors">
              {/* Main row with all info */}
              <div className="flex items-center gap-3 w-full">
                {/* Icon - Fixed width */}
                <div className="w-10 flex-shrink-0">
                  {fileUpload.isValidating ? (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-400 border-t-transparent"></div>
                    </div>
                  ) : fileUpload.isDuplicate ? (
                    <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                      <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                  ) : fileUpload.status === 'uploading' ? (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                    </div>
                  ) : fileUpload.status === 'success' ? (
                    <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                      <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : fileUpload.status === 'error' ? (
                    <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                      <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  ) : (
                    getFileTypeIcon(getFileType(fileUpload.name))
                  )}
                </div>

                {/* Asset Name Input - Flexible width */}
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={baseName}
                    onChange={(e) => updateFileName(fileUpload.id, e.target.value)}
                    disabled={fileUpload.status !== 'pending'}
                    className={`w-full text-sm font-medium rounded px-3 py-2 focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:text-gray-600 ${
                      fileUpload.isDuplicate
                        ? 'bg-orange-50 border border-orange-300 hover:border-orange-400 focus:border-orange-500 focus:ring-orange-500 text-orange-900'
                        : 'text-gray-900 bg-white border border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500'
                    } ${fileUpload.status !== 'pending' ? 'disabled:bg-gray-50 disabled:border-gray-200' : ''}`}
                    placeholder="Asset name"
                  />
                </div>

                {/* Extension - Fixed width */}
                <div className="w-20 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-600 px-2 py-2 bg-gray-50 border border-gray-200 rounded block text-center truncate">
                    {extension}
                  </span>
                </div>

                {/* Current Tags - Flexible width */}
                <div className="flex-1 min-w-[180px]">
                  <input
                    type="text"
                    value={fileUpload.tags.join(', ')}
                    onChange={(e) => updateFileTags(fileUpload.id, e.target.value)}
                    disabled={fileUpload.status !== 'pending'}
                    placeholder="Add tags..."
                    className="w-full text-sm text-gray-700 bg-white border border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-3 py-2 disabled:bg-gray-50 disabled:border-gray-200 disabled:cursor-not-allowed disabled:text-gray-500"
                  />
                </div>

                {/* Type - Fixed width */}
                <div className="w-28 flex-shrink-0">
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    <span className="font-semibold">TYPE:</span> <span className="text-gray-700">{getFileType(fileUpload.name)}</span>
                  </div>
                </div>

                {/* Size - Fixed width */}
                <div className="w-28 flex-shrink-0">
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    <span className="font-semibold">SIZE:</span> <span className="text-gray-700">{(fileUpload.file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* Actions - Fixed width */}
                <div className="w-28 flex-shrink-0 flex items-center justify-end gap-1">
                  {fileUpload.status === 'pending' && (
                    <button
                      onClick={() => startUpload(fileUpload)}
                      disabled={fileUpload.isDuplicate || fileUpload.isValidating}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                      title={fileUpload.isDuplicate ? 'Cannot upload - duplicate name' : fileUpload.isValidating ? 'Validating...' : 'Upload file'}
                    >
                      Upload
                    </button>
                  )}
                  {fileUpload.status === 'error' && !fileUpload.isDuplicate && (
                    <button
                      onClick={() => startUpload(fileUpload)}
                      className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors font-medium"
                    >
                      Retry
                    </button>
                  )}
                  {fileUpload.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(fileUpload.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove file"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Error message - Full width below */}
              {fileUpload.error && (
                <div className={`text-sm mt-3 flex items-start gap-2 p-3 rounded ${fileUpload.isDuplicate ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
                  <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{fileUpload.error}</span>
                </div>
              )}

              {/* Progress bar - Full width below */}
              {fileUpload.status === 'uploading' && (
                <div className="mt-3 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${fileUpload.progress}%` }}></div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
