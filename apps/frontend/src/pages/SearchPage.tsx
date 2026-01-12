import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assetApi } from '../api/asset.api';
import { AssetType } from '@cx-dam/shared';

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [workspace, setWorkspace] = useState('');
  const [fileType, setFileType] = useState<AssetType | ''>('');
  const [tags, setTags] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery.trim()) {
        setShowDropdown(true);
        setHasSearched(true);
      } else if (!workspace && !fileType && !tags) {
        // Reset to landing page if search is cleared and no filters are active
        setHasSearched(false);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, workspace, fileType, tags]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Only fetch when we have a search query or filters applied
  const shouldFetch = hasSearched && (!!debouncedQuery.trim() || !!workspace || !!fileType || !!tags);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['assets', 'search', debouncedQuery, workspace, fileType, tags, page],
    queryFn: () =>
      assetApi.search({
        q: debouncedQuery || undefined,
        workspace: workspace || undefined,
        fileType: fileType || undefined,
        tags: tags || undefined,
        page,
        limit: 20,
      }),
    enabled: shouldFetch,
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    setShowDropdown(false);
    setPage(1);
  };

  const handleClearFilters = () => {
    setWorkspace('');
    setFileType('');
    setTags('');
    setPage(1);
    // If search is also empty, reset to landing page
    if (!searchQuery.trim()) {
      setHasSearched(false);
      setShowDropdown(false);
    }
  };

  const activeFiltersCount = [workspace, fileType, tags].filter(Boolean).length;

  return (
    <div className="min-h-screen">
      {/* Google Drive-style header with search */}
      <div className={`${!hasSearched ? 'flex items-center justify-center min-h-[60vh]' : 'mb-8'}`}>
        <div className="w-full max-w-4xl mx-auto">
          {!hasSearched && (
            <div className="text-center mb-8">
              <h1 className="text-5xl font-normal text-gray-700 mb-2">CX Asset Search</h1>
              <p className="text-gray-500">Search across all CX digital assets</p>
            </div>
          )}

          {/* Search bar - fixed position when searching */}
          <div ref={searchRef} className="relative">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
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
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (debouncedQuery.trim() && data) {
                      setShowDropdown(true);
                    }
                  }}
                  placeholder="Search by asset name..."
                  className="w-full pl-12 pr-24 py-4 text-lg border-2 border-gray-300 rounded-full focus:outline-none focus:border-blue-500 shadow-lg hover:shadow-xl transition-shadow"
                />
                <div className="absolute inset-y-0 right-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-full hover:bg-gray-100 transition-colors relative ${
                      activeFiltersCount > 0 ? 'text-blue-600' : 'text-gray-500'
                    }`}
                    title="Filters"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                      />
                    </svg>
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                  >
                    Search
                  </button>
                </div>
              </div>
            </form>

            {/* Dropdown results */}
            {showDropdown && shouldFetch && (
              <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : data?.data.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No assets found</div>
                ) : (
                  <div>
                    {data?.data.slice(0, 8).map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => {
                          setShowDropdown(false);
                          window.open(asset.downloadUrl, '_blank');
                        }}
                        className="w-full p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 text-left transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {asset.fileType === 'image' ? (
                              <img
                                src={asset.downloadUrl}
                                alt={asset.name}
                                className="w-12 h-12 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                                <span className="text-xs text-gray-600 uppercase">
                                  {asset.fileType}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="font-medium text-gray-900 truncate">{asset.name}</div>
                            <div className="text-sm text-gray-500 truncate">{asset.workspace}</div>
                          </div>
                          <div className="flex-shrink-0 text-xs text-gray-400">
                            {(asset.size / 1024).toFixed(0)} KB
                          </div>
                        </div>
                      </button>
                    ))}
                    {data && data.data.length > 8 && (
                      <div className="p-3 text-center text-sm text-blue-600 font-medium">
                        Press Search to see all {data.pagination.total} results
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filters panel - expands below with smooth animation */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showFilters ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="p-6 bg-white rounded-lg shadow-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Workspace
                  </label>
                  <input
                    type="text"
                    value={workspace}
                    onChange={(e) => {
                      setWorkspace(e.target.value);
                      setPage(1);
                    }}
                    placeholder="e.g., salesforcedocs/docs"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    File Type
                  </label>
                  <select
                    value={fileType}
                    onChange={(e) => {
                      setFileType(e.target.value as AssetType | '');
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All types</option>
                    <option value={AssetType.IMAGE}>Images</option>
                    <option value={AssetType.VIDEO}>Videos</option>
                    <option value={AssetType.DOCUMENT}>Documents</option>
                    <option value={AssetType.ARCHIVE}>Archives</option>
                    <option value={AssetType.OTHER}>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => {
                      setTags(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Comma-separated tags"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results grid */}
      {hasSearched && !showDropdown && (
        <div className="w-full">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Searching...</p>
            </div>
          ) : isError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg shadow-md p-12 text-center">
              <svg
                className="h-16 w-16 text-red-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-800 text-lg font-medium mb-2">Error loading assets</p>
              <p className="text-red-600 text-sm">
                {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again later.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Refresh Page
              </button>
            </div>
          ) : !data || data.data.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <svg
                className="h-16 w-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-gray-600 text-lg font-medium mb-2">No assets found</p>
              <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Found {data?.pagination.total} result{data?.pagination.total !== 1 ? 's' : ''}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data?.data.map((asset) => (
                  <div
                    key={asset.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer group"
                    onClick={() => window.open(asset.downloadUrl, '_blank')}
                  >
                    <div className="aspect-video bg-gray-100 flex items-center justify-center overflow-hidden">
                      {asset.fileType === 'image' ? (
                        <img
                          src={asset.downloadUrl}
                          alt={asset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <div className="text-3xl text-gray-400 mb-2">
                            {asset.fileType === 'video' && '🎥'}
                            {asset.fileType === 'document' && '📄'}
                            {asset.fileType === 'archive' && '📦'}
                            {asset.fileType === 'other' && '📎'}
                          </div>
                          <div className="text-xs text-gray-600 uppercase font-medium">
                            {asset.fileType}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-sm text-gray-900 truncate mb-1">
                        {asset.name}
                      </h3>
                      <p className="text-xs text-gray-500 truncate mb-2">{asset.workspace}</p>
                      {asset.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {asset.tags.slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {asset.tags.length > 2 && (
                            <span className="text-xs text-gray-500">+{asset.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-400">
                        {(asset.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {data && data.pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    Page {page} of {data.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === data.pagination.totalPages}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
