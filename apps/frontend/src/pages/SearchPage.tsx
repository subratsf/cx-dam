import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { assetApi } from '../api/asset.api';
import { AssetType, Asset } from '@cx-dam/shared';
import { useAuthStore } from '../stores/auth.store';
import { AssetCard } from '../components/AssetCard';
import { AssetDetailModal } from '../components/AssetDetailModal';
import { AssetEditModal } from '../components/AssetEditModal';

export function SearchPage() {
  const { permissions } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params
  const [searchMode, setSearchMode] = useState<'name' | 'semantic'>(searchParams.get('mode') as 'name' | 'semantic' || 'name');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedAsset, setSelectedAsset] = useState<(Asset & { downloadUrl: string }) | null>(null);
  const [assetToEdit, setAssetToEdit] = useState<(Asset & { downloadUrl: string }) | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearchInputFocused, setIsSearchInputFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!(searchParams.get('q') || searchParams.get('workspace') || searchParams.get('fileType') || searchParams.get('tags')));
  const [isReplacingAsset, setIsReplacingAsset] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter states - initialize from URL params
  const [workspace, setWorkspace] = useState(searchParams.get('workspace') || '');
  const [workspaceSearch, setWorkspaceSearch] = useState(searchParams.get('workspace') || '');
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [fileType, setFileType] = useState<AssetType | ''>(searchParams.get('fileType') as AssetType || '');
  const [tags, setTags] = useState(searchParams.get('tags') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);

  // Get all unique repositories from permissions
  const availableRepos = permissions.map((p) => p.repoFullName).sort();

  // Filter repos based on search
  const filteredWorkspaces = availableRepos.filter((repo) =>
    repo.toLowerCase().includes(workspaceSearch.toLowerCase())
  );

  // Update URL params when search state changes
  useEffect(() => {
    const params = new URLSearchParams();

    if (searchMode !== 'name') params.set('mode', searchMode);
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (workspace && searchMode === 'name') params.set('workspace', workspace);
    if (fileType && searchMode === 'name') params.set('fileType', fileType);
    if (tags && searchMode === 'name') params.set('tags', tags);
    if (page > 1) params.set('page', page.toString());

    // Only update URL if there are search params or we had params before
    if (params.toString() || searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [searchMode, debouncedQuery, workspace, fileType, tags, page]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery.trim()) {
        // Only show dropdown if input is focused
        if (isSearchInputFocused) {
          setShowDropdown(true);
        }
        setHasSearched(true);
      } else if (!workspace && !fileType && !tags) {
        // Reset to landing page if search is cleared and no filters are active
        setHasSearched(false);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, workspace, fileType, tags, isSearchInputFocused]);

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
  const shouldFetchSemantic = hasSearched && searchMode === 'semantic' && !!debouncedQuery.trim();

  // Name search query
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
    enabled: shouldFetch && searchMode === 'name',
    retry: false,
  });

  // Semantic search query
  const { data: semanticData, isLoading: isSemanticLoading, isError: isSemanticError, error: semanticError } = useQuery({
    queryKey: ['assets', 'semantic-search', debouncedQuery, page],
    queryFn: () => assetApi.semanticSearch(debouncedQuery, 20),
    enabled: shouldFetchSemantic,
    retry: false,
  });

  // Use appropriate data based on search mode
  const currentData = searchMode === 'semantic' ? semanticData : data;
  const currentIsLoading = searchMode === 'semantic' ? isSemanticLoading : isLoading;
  const currentIsError = searchMode === 'semantic' ? isSemanticError : isError;
  const currentError = searchMode === 'semantic' ? semanticError : error;

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

          {/* Search Mode Tabs */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setSearchMode('name');
                  setPage(1);
                }}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  searchMode === 'name'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                📝 Name Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchMode('semantic');
                  setPage(1);
                  setWorkspace('');
                  setFileType('');
                  setTags('');
                }}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  searchMode === 'semantic'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                🔍 AI Semantic Search
              </button>
            </div>
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
                    setIsSearchInputFocused(true);
                    if (debouncedQuery.trim() && currentData) {
                      setShowDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow clicking on dropdown items
                    setTimeout(() => {
                      setIsSearchInputFocused(false);
                      setShowDropdown(false);
                    }, 200);
                  }}
                  placeholder={searchMode === 'semantic' ? 'Describe what you\'re looking for...' : 'Search by asset name...'}
                  className="w-full pl-12 pr-24 py-4 text-lg border-2 border-gray-300 rounded-full focus:outline-none focus:border-blue-500 shadow-lg hover:shadow-xl transition-shadow"
                />
                <div className="absolute inset-y-0 right-2 flex items-center gap-2">
                  {searchMode === 'name' && (
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
                  )}
                  <button
                    type="submit"
                    className={`px-6 py-2 text-white rounded-full hover:bg-opacity-90 transition-colors ${
                      searchMode === 'semantic' ? 'bg-purple-600' : 'bg-blue-600'
                    }`}
                  >
                    Search
                  </button>
                </div>
              </div>
            </form>

            {/* Dropdown results - only show when input is focused */}
            {showDropdown && isSearchInputFocused && (shouldFetch || shouldFetchSemantic) && (
              <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
                {currentIsLoading ? (
                  <div className="p-4 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : currentData?.data.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No assets found</div>
                ) : (
                  <div>
                    {currentData?.data.slice(0, 8).map((asset) => (
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
                    {currentData && currentData.data.length > 8 && (
                      <div className="p-3 text-center text-sm text-blue-600 font-medium">
                        Press Search to see all {currentData.pagination.total} results
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filters panel - expands below with smooth animation (only for name search) */}
          {searchMode === 'name' && (
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
          )}
        </div>
      </div>

      {/* Results grid - show when not focused on search input or explicitly searched */}
      {hasSearched && (!isSearchInputFocused || !showDropdown) && (
        <div className="flex-1 overflow-y-auto w-full">
          {!shouldFetch && !shouldFetchSemantic ? (
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
          ) : currentIsLoading ? (
            <div className="text-center py-12">
              <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${searchMode === 'semantic' ? 'border-purple-600' : 'border-blue-600'}`}></div>
              <p className="mt-4 text-gray-600">{searchMode === 'semantic' ? 'Analyzing with AI...' : 'Searching...'}</p>
            </div>
          ) : currentIsError ? (
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
                {currentError instanceof Error ? currentError.message : 'An unexpected error occurred. Please try again later.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Refresh Page
              </button>
            </div>
          ) : !currentData || currentData.data.length === 0 ? (
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
                {currentData?.data.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} onOpenDetail={setSelectedAsset} onEdit={setAssetToEdit} />
                ))}
              </div>

              {currentData && currentData.pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 mt-8 mb-8 px-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium text-sm text-gray-700"
                  >
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700 font-medium bg-gray-50 rounded-md border border-gray-200">
                    Page {page} of {currentData.pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === currentData.pagination.totalPages}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium text-sm text-gray-700"
                  >
                    Next
                    <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Asset Edit Modal */}
      {assetToEdit && (
        <AssetEditModal
          asset={assetToEdit}
          isOpen={!!assetToEdit}
          onClose={() => setAssetToEdit(null)}
          onReplaceStart={() => setIsReplacingAsset(true)}
          onReplaceComplete={() => setIsReplacingAsset(false)}
        />
      )}

      {/* Full Page Loader during asset replacement */}
      {isReplacingAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Replacing Asset</h3>
              <p className="text-gray-600 text-center">
                Uploading new file and updating metadata...
              </p>
              <div className="mt-4 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full animate-pulse" style={{ width: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
