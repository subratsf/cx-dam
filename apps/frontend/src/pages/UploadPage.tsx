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
  tags: string[];
  status: UploadStatus;
  progress: number;
  error?: string;
}

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
  const [defaultTags, setDefaultTags] = useState('');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  const uploadableRepos = permissions.filter((p) => canUploadAsset(p.permission));

  // Function to update file name
  const updateFileName = (id: string, newName: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName } : f))
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
      // Request upload URL
      const { uploadUrl } = await assetApi.requestUploadUrl({
        name: fileUpload.name,
        workspace: fileUpload.workspace,
        tags: fileUpload.tags,
        mimeType: fileUpload.file.type,
        size: fileUpload.file.size,
      });

      // Update progress
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileUpload.id ? { ...f, progress: 50 } : f
        )
      );

      // Upload to S3
      await assetApi.uploadToS3(uploadUrl, fileUpload.file);

      // Update to 100%
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileUpload.id ? { ...f, progress: 100 } : f
        )
      );
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

    const tagsArray = defaultTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const newFiles: FileUpload[] = Array.from(fileList).map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      workspace: selectedWorkspace,
      tags: tagsArray,
      status: 'pending' as UploadStatus,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
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

  const startUpload = (fileUpload: FileUpload) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileUpload.id ? { ...f, status: 'uploading' } : f
      )
    );
    uploadMutation.mutate(fileUpload);
  };

  const uploadAll = () => {
    files
      .filter((f) => f.status === 'pending' || f.status === 'error')
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

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

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
              Default Tags (optional)
            </label>
            <input
              type="text"
              value={defaultTags}
              onChange={(e) => setDefaultTags(e.target.value)}
              placeholder="e.g., documentation, screenshot"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Drag & Drop area */}
      <div
        onDragOver={selectedWorkspace ? handleDragOver : undefined}
        onDragLeave={selectedWorkspace ? handleDragLeave : undefined}
        onDrop={selectedWorkspace ? handleDrop : undefined}
        className={`bg-white rounded-lg shadow border-2 border-dashed transition-colors p-12 text-center mb-6 flex-shrink-0 ${
          !selectedWorkspace
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
          disabled={!selectedWorkspace}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={!selectedWorkspace ? 'cursor-not-allowed' : 'cursor-pointer'}
        >
          <div className="flex flex-col items-center">
            <svg
              className={`h-16 w-16 mb-4 ${!selectedWorkspace ? 'text-gray-300' : 'text-gray-400'}`}
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
              <>
                <p className="text-lg text-gray-400 mb-2">Please select a workspace first</p>
                <p className="text-sm text-gray-400">Choose a repository above to enable file uploads</p>
              </>
            ) : (
              <>
                <p className="text-lg text-gray-700 mb-2">
                  {isDragging ? 'Drop files here' : 'Drag and drop files here'}
                </p>
                <p className="text-sm text-gray-500 mb-4">or</p>
                <span className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  Select files
                </span>
              </>
            )}
          </div>
        </label>
      </div>

      {/* Action buttons */}
      {files.length > 0 && (
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {files.length} file{files.length !== 1 ? 's' : ''} •{' '}
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
        <div className="bg-white rounded-lg shadow border border-gray-200 divide-y divide-gray-200 flex-1 overflow-y-auto">
          {files.map((fileUpload) => (
            <div key={fileUpload.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                {/* File type icon or status */}
                <div className="flex-shrink-0">
                  {fileUpload.status === 'uploading' ? (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                    </div>
                  ) : fileUpload.status === 'success' ? (
                    <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  ) : fileUpload.status === 'error' ? (
                    <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-red-600"
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
                    </div>
                  ) : (
                    getFileTypeIcon(getFileType(fileUpload.name))
                  )}
                </div>

                {/* File info */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-grow">
                      {/* Single row with name, type, and size */}
                      <div className="flex items-center gap-3 mb-1">
                        {/* Editable name input */}
                        <input
                          type="text"
                          value={fileUpload.name}
                          onChange={(e) => updateFileName(fileUpload.id, e.target.value)}
                          disabled={fileUpload.status !== 'pending'}
                          className="flex-grow text-sm font-medium text-gray-900 bg-blue-50 border border-blue-200 hover:border-blue-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded px-2 py-1 disabled:bg-gray-100 disabled:border-gray-200 disabled:cursor-not-allowed disabled:text-gray-600 min-w-0"
                          placeholder="Asset name"
                        />

                        {/* Metadata inline */}
                        <div className="flex items-center gap-2 text-xs text-gray-600 flex-shrink-0">
                          <span className="inline-flex items-center font-medium">
                            {getFileType(fileUpload.name).toUpperCase()}
                          </span>
                          <span>•</span>
                          <span>{(fileUpload.file.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>

                      {/* Tags in a separate row if present */}
                      {fileUpload.tags.length > 0 && (
                        <div className="text-xs text-gray-500 truncate">
                          Tags: {fileUpload.tags.join(', ')}
                        </div>
                      )}

                      {fileUpload.error && (
                        <p className="text-xs text-red-600 mt-1">{fileUpload.error}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {fileUpload.status === 'pending' && (
                        <button
                          onClick={() => startUpload(fileUpload)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                        >
                          Upload
                        </button>
                      )}
                      {fileUpload.status === 'error' && (
                        <button
                          onClick={() => startUpload(fileUpload)}
                          className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors font-medium"
                        >
                          Retry
                        </button>
                      )}
                      {fileUpload.status !== 'uploading' && (
                        <button
                          onClick={() => removeFile(fileUpload.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove file"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {fileUpload.status === 'uploading' && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-blue-600 h-1 rounded-full transition-all"
                        style={{ width: `${fileUpload.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
