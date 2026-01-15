import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assetApi } from '../api/asset.api';
import { AssetType, Asset } from '@cx-dam/shared';
import { useAuthStore } from '../stores/auth.store';
import { AssetCard } from '../components/AssetCard';
import { AssetDetailModal } from '../components/AssetDetailModal';

export function SearchPage() {
  const { permissions } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<(Asset & { downloadUrl: string }) | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [workspace, setWorkspace] = useState('');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [fileType, setFileType] = useState<AssetType | ''>('');
  const [tags, setTags] = useState('');
  const [page, setPage] = useState(1);
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  // Get all unique repositories from permissions
  const availableRepos = permissions.map((p) => p.repoFullName).sort();

  // Filter repos based on search
  const filteredWorkspaces = availableRepos.filter((repo) =>
    repo.toLowerCase().includes(workspaceSearch.toLowerCase())
  );

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
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
        setShowWorkspaceDropdown(false);
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
    setWorkspaceSearch('');
    setFileType('');
    setTags('');
    setPage(1);
    // If search is also empty, reset to landing page
    if (!searchQuery.trim()) {
      setHasSearched(false);
      setShowDropdown(false);
    }
  };

  const handleWorkspaceSelect = (repoFullName: string) => {
    setWorkspace(repoFullName);
    setWorkspaceSearch(repoFullName);
    setShowWorkspaceDropdown(false);
    setPage(1);
  };

  const activeFiltersCount = [workspace, fileType, tags].filter(Boolean).length;

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden flex flex-col">
      {/* Google Drive-style header with search */}
      <div className={`flex-shrink-0 transition-all duration-500 ease-in-out ${
        !hasSearched ? 'flex items-center justify-center min-h-[50vh]' : 'mb-6'
      }`}>
        <div className="w-full max-w-4xl mx-auto">
          <div className={`text-center mb-8 transition-all duration-500 ease-in-out ${
            !hasSearched ? 'opacity-100 max-h-32' : 'opacity-0 max-h-0 mb-0 overflow-hidden'
          }`}>
            <h1 className="text-5xl font-normal text-gray-700 mb-2">CX Asset Search</h1>
            <p className="text-gray-500">Search across all CX digital assets</p>
          </div>

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
                    onClick={() => {
                      setShowFilters(!showFilters);
                      setShowDropdown(false); // Close dropdown when opening filters
                    }}
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
            className={`transition-all duration-300 ease-in-out ${
              showFilters ? 'opacity-100 mt-4' : 'max-h-0 opacity-0'
            }`}
            style={{
              overflow: showFilters ? 'visible' : 'hidden',
              maxHeight: showFilters ? '500px' : '0'
            }}
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
                <div ref={workspaceDropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Workspace
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={workspaceSearch}
                      onChange={(e) => {
                        setWorkspaceSearch(e.target.value);
                        setShowWorkspaceDropdown(true);
                        if (!e.target.value) {
                          setWorkspace('');
                        }
                      }}
                      onFocus={() => setShowWorkspaceDropdown(true)}
                      placeholder="Search repositories..."
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
                  {showWorkspaceDropdown && filteredWorkspaces.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredWorkspaces.map((repo) => (
                        <button
                          key={repo}
                          type="button"
                          onClick={() => handleWorkspaceSelect(repo)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${
                            workspace === repo
                              ? 'bg-blue-100 text-blue-900 font-medium'
                              : 'text-gray-900'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{repo}</span>
                            {workspace === repo && (
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
                  {showWorkspaceDropdown && workspaceSearch && filteredWorkspaces.length === 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg p-3 text-center text-gray-500 text-sm">
                      No repositories found
                    </div>
                  )}
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
        <div className="flex-1 overflow-y-auto w-full">
          {!shouldFetch ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-md p-12 text-center">
              <svg
                className="h-16 w-16 text-blue-400 mx-auto mb-4"
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
              <p className="text-blue-800 text-lg font-medium mb-2">No search criteria provided</p>
              <p className="text-blue-600 text-sm">
                Please enter a search query or select a workspace to view assets
              </p>
            </div>
          ) : isLoading ? (
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
              <div className="mb-4 text-base font-medium text-gray-700">
                Found {data?.pagination.total} result{data?.pagination.total !== 1 ? 's' : ''}
                {(debouncedQuery || workspace || fileType || tags) && (
                  <span className="text-gray-500 font-normal">
                    {' '}for{' '}
                    {[
                      debouncedQuery && `"${debouncedQuery}"`,
                      workspace && `workspace: ${workspace}`,
                      fileType && `type: ${fileType}`,
                      tags && `tags: ${tags}`
                    ].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {data?.data.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} onOpenDetail={setSelectedAsset} />
                ))}
              </div>

              {data && data.pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 mt-8 mb-8 px-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700 font-medium bg-gray-50 rounded-md border border-gray-200">
                    Page {page} of {data.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === data.pagination.totalPages}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium text-sm"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          isOpen={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}
