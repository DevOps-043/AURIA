import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { desktopBridge } from "@/shared/api/desktop-bridge";
import { useDebounce } from "./use-debounce";
import type { GitHubRepo } from "../../../shared/github-types";

const REPOS_PER_PAGE = 30;

/**
 * Fetches the authenticated user's GitHub repositories with pagination
 * and debounced search. All GitHub API calls are proxied through the
 * main process to keep the provider token out of the renderer.
 */
export function useGitHubRepos() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  const query = useInfiniteQuery({
    queryKey: ["github-repos", debouncedSearch],
    queryFn: async ({ pageParam = 1 }) => {
      const result = await desktopBridge.github.listRepos(
        pageParam,
        REPOS_PER_PAGE,
        debouncedSearch || undefined,
      );
      return result;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.hasNextPage ? lastPageParam + 1 : undefined,
    enabled: true,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Flatten all pages into a single array
  const repos: GitHubRepo[] =
    query.data?.pages.flatMap((page) => page.repos) ?? [];

  return {
    repos,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage ?? false,
    search,
    setSearch,
    refetch: query.refetch,
  };
}
