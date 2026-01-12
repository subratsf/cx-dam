import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { assetApi } from '../api/asset.api';
import { useAuthStore } from '../stores/auth.store';
import { PermissionLevel, canUploadAsset } from '@cx-dam/shared';

export function UploadPage() {
  const { permissions } = useAuthStore();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [tags, setTags] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadableRepos = permissions.filter((p) => canUploadAsset(p.permission));

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');

      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Request upload URL
      const { uploadUrl } = await assetApi.requestUploadUrl({
        name,
        workspace,
        tags: tagArray,
        mimeType: file.type,
        size: file.size,
      });

      // Upload to S3
      setUploadProgress(50);
      await assetApi.uploadToS3(uploadUrl, file);
      setUploadProgress(100);
    },
    onSuccess: () => {
      // Reset form
      setFile(null);
      setName('');
      setTags('');
      setUploadProgress(0);
      alert('Asset uploaded successfully!');
    },
    onError: (error: any) => {
      setUploadProgress(0);
      alert(error.response?.data?.error?.message || 'Upload failed');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!name) {
        setName(selectedFile.name);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name || !workspace) {
      alert('Please fill in all required fields');
      return;
    }
    uploadMutation.mutate();
  };

  if (uploadableRepos.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-yellow-800 mb-2">
          No Upload Permissions
        </h2>
        <p className="text-yellow-700">
          You need write access to at least one repository in the salesforcedocs
          organization to upload assets.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Upload Asset</h1>

      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File *
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              required
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asset Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter asset name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workspace (Repository) *
            </label>
            <select
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">Select a repository...</option>
              {uploadableRepos.map((repo) => (
                <option key={repo.repoFullName} value={repo.repoFullName}>
                  {repo.repoFullName} ({repo.permission})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., documentation, screenshot, v2.0"
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {uploadProgress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploadMutation.isPending}
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload Asset'}
          </button>
        </form>
      </div>
    </div>
  );
}
