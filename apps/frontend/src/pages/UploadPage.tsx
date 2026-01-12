import { useState, useRef } from 'react';
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

export function UploadPage() {
  const { permissions } = useAuthStore();
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [defaultTags, setDefaultTags] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadableRepos = permissions.filter((p) => canUploadAsset(p.permission));

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
    if (!fileList || !selectedWorkspace) {
      if (!selectedWorkspace) {
        alert('Please select a workspace first');
      }
      return;
    }

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
      <div className="max-w-4xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            No Upload Permissions
          </h2>
          <p className="text-yellow-700">
            You need write access to at least one repository in the salesforcedocs
            organization to upload assets.
          </p>
        </div>
      </div>
    );
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-normal text-gray-700">Upload files</h1>
      </div>

      {/* Upload settings */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workspace (Repository) *
            </label>
            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a repository...</option>
              {uploadableRepos.map((repo) => (
                <option key={repo.repoFullName} value={repo.repoFullName}>
                  {repo.repoFullName}
                </option>
              ))}
            </select>
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-white rounded-lg shadow border-2 border-dashed transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } p-12 text-center mb-6`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center">
            <svg
              className="h-16 w-16 text-gray-400 mb-4"
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
            <p className="text-lg text-gray-700 mb-2">
              {isDragging ? 'Drop files here' : 'Drag and drop files here'}
            </p>
            <p className="text-sm text-gray-500 mb-4">or</p>
            <span className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
              Select files
            </span>
          </div>
        </label>
      </div>

      {/* Action buttons */}
      {files.length > 0 && (
        <div className="flex items-center justify-between mb-4">
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
                disabled={uploadMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Upload all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Files list */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 divide-y divide-gray-200">
          {files.map((fileUpload) => (
            <div key={fileUpload.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                {/* File icon/status */}
                <div className="flex-shrink-0">
                  {fileUpload.status === 'pending' && (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                      <svg
                        className="h-6 w-6 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                  {fileUpload.status === 'uploading' && (
                    <div className="w-10 h-10 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                    </div>
                  )}
                  {fileUpload.status === 'success' && (
                    <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center">
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
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                  {fileUpload.status === 'error' && (
                    <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center">
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-grow">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileUpload.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(fileUpload.file.size / 1024).toFixed(1)} KB •{' '}
                        {fileUpload.workspace}
                        {fileUpload.tags.length > 0 && (
                          <> • {fileUpload.tags.join(', ')}</>
                        )}
                      </p>
                      {fileUpload.error && (
                        <p className="text-xs text-red-600 mt-1">{fileUpload.error}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {fileUpload.status === 'pending' && (
                        <button
                          onClick={() => startUpload(fileUpload)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Upload
                        </button>
                      )}
                      {fileUpload.status === 'error' && (
                        <button
                          onClick={() => startUpload(fileUpload)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Retry
                        </button>
                      )}
                      {fileUpload.status !== 'uploading' && (
                        <button
                          onClick={() => removeFile(fileUpload.id)}
                          className="text-sm text-gray-500 hover:text-gray-700"
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
