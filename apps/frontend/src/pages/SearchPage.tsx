import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assetApi } from '../api/asset.api';

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tags, setTags] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['assets', 'search', searchQuery, tags, page],
    queryFn: () =>
      assetApi.search({
        q: searchQuery || undefined,
        tags: tags || undefined,
        page,
        limit: 20,
      }),
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Search Assets</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by name
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Enter asset name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => {
                setTags(e.target.value);
                setPage(1);
              }}
              placeholder="Comma-separated tags..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : data?.data.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600">No assets found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.data.map((asset) => (
              <div
                key={asset.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {asset.file_type === 'image' && (
                  <img
                    src={asset.downloadUrl}
                    alt={asset.name}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2">{asset.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Workspace: {asset.workspace}
                  </p>
                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {asset.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Size: {(asset.size / 1024).toFixed(2)} KB
                  </p>
                  <a
                    href={asset.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block w-full bg-blue-600 text-white text-center px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-white border rounded-md disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === data.pagination.totalPages}
                className="px-4 py-2 bg-white border rounded-md disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
