/**
 * 往来账单筛选状态管理Hook
 * 职责：管理搜索、筛选、排序和分页状态
 */

import { useRouter } from 'next/navigation';
import * as React from 'react';

interface StatementsQueryParams {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

interface UseStatementsFiltersProps {
  initialParams: StatementsQueryParams;
}

/**
 * 构建往来账单URL查询参数
 */
function buildStatementsURLParams(params: {
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}) {
  const urlParams = new URLSearchParams();
  if (params.search) {
    urlParams.set('search', params.search);
  }
  if (params.type && params.type !== 'all') {
    urlParams.set('type', params.type);
  }
  if (params.sortBy) {
    urlParams.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    urlParams.set('sortOrder', params.sortOrder);
  }
  if (params.page && params.page > 1) {
    urlParams.set('page', params.page.toString());
  }
  if (params.limit) {
    urlParams.set('limit', params.limit.toString());
  }
  if (params.startDate) {
    urlParams.set('startDate', params.startDate);
  }
  if (params.endDate) {
    urlParams.set('endDate', params.endDate);
  }
  return urlParams;
}

export function useStatementsFilters({
  initialParams,
}: UseStatementsFiltersProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const s = useStatementsLocalState(initialParams);
  const searchTimerRef = s.searchTimerRef;
  // ✅ 搜索处理:立即更新UI,300ms后更新URL和查询
  const handleSearch = React.useMemo(
    () =>
      createHandleSearch({
        setSearchInput: s.setSearchInput,
        searchTimerRef: s.searchTimerRef,
        setIsSearching: s.setIsSearching,
        setSearch: s.setSearch,
        state: {
          type: s.type,
          sortBy: s.sortBy,
          sortOrder: s.sortOrder,
          startDate: s.startDate,
          endDate: s.endDate,
        },
        ctx: {
          buildURLParams: buildStatementsURLParams,
          limit: initialParams.limit,
          router,
          startTransition,
        },
      }),
    [
      s.setSearchInput,
      s.searchTimerRef,
      s.setIsSearching,
      s.setSearch,
      s.type,
      s.sortBy,
      s.sortOrder,
      s.startDate,
      s.endDate,
      initialParams.limit,
      router,
      startTransition,
    ]
  );

  // ✅ 清理定时器
  React.useEffect(() => {
    const timerRef = searchTimerRef;
    return () => {
      const timer = timerRef.current;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [searchTimerRef]);

  // 组合其余处理器，减少主Hook体积
  const { handleFilter, handlePageChange, handleDateRangeChange } =
    React.useMemo(
      () =>
        createStatementsHandlers({
          type: s.type,
          sortBy: s.sortBy,
          sortOrder: s.sortOrder,
          startDate: s.startDate,
          endDate: s.endDate,
          search: s.search,
          setType: s.setType,
          setSortBy: s.setSortBy,
          setSortOrder: s.setSortOrder,
          setStartDate: s.setStartDate,
          setEndDate: s.setEndDate,
          ctx: {
            buildURLParams: buildStatementsURLParams,
            router,
            startTransition,
          },
          limit: initialParams.limit,
        }),
      [
        s.type,
        s.sortBy,
        s.sortOrder,
        s.startDate,
        s.endDate,
        s.search,
        s.setType,
        s.setSortBy,
        s.setSortOrder,
        s.setStartDate,
        s.setEndDate,
        router,
        startTransition,
        initialParams.limit,
      ]
    );

  return {
    filters: {
      search: s.search,
      searchInput: s.searchInput,
      isSearching: s.isSearching,
      type: s.type,
      sortBy: s.sortBy,
      sortOrder: s.sortOrder,
      startDate: s.startDate,
      endDate: s.endDate,
    },
    handlers: {
      handleSearch,
      handleFilter,
      handlePageChange,
      handleDateRangeChange,
    },
  };
}

// 本地状态封装，减少主Hook体积
function useStatementsLocalState(initialParams: StatementsQueryParams) {
  const [searchInput, setSearchInput] = React.useState(
    initialParams.search || ''
  );
  const searchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [type, setType] = React.useState(initialParams.type || 'all');
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'totalAmount'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );
  const [startDate, setStartDate] = React.useState<string | undefined>(
    initialParams.startDate
  );
  const [endDate, setEndDate] = React.useState<string | undefined>(
    initialParams.endDate
  );

  React.useEffect(() => {
    setSearchInput(initialParams.search || '');
    setSearch(initialParams.search || '');
  }, [initialParams.search]);

  React.useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    []
  );

  return {
    searchInput,
    setSearchInput,
    searchTimerRef,
    isSearching,
    setIsSearching,
    search,
    setSearch,
    type,
    setType,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  } as const;
}

// 辅助：统一 push 逻辑，减少重复代码
function pushWithParams(args: {
  buildURLParams: typeof buildStatementsURLParams;
  router: ReturnType<typeof useRouter>;
  startTransition: React.TransitionStartFunction;
  params: Parameters<typeof buildStatementsURLParams>[0];
}) {
  const { buildURLParams, router, startTransition, params } = args;
  startTransition(() => {
    const sp = buildURLParams(params);
    router.push(`/finance/statements?${sp.toString()}`);
  });
}

// 辅助：创建搜索处理器
function createHandleSearch(args: {
  setSearchInput: (v: string) => void;
  searchTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  setIsSearching: (v: boolean) => void;
  setSearch: (v: string) => void;
  state: {
    type: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    startDate?: string;
    endDate?: string;
  };
  ctx: {
    buildURLParams: typeof buildStatementsURLParams;
    limit?: number;
    router: ReturnType<typeof useRouter>;
    startTransition: React.TransitionStartFunction;
  };
}) {
  const {
    setSearchInput,
    searchTimerRef,
    setIsSearching,
    setSearch,
    state,
    ctx,
  } = args;
  return (value: string) => {
    const trimmed = value.trimStart();
    setSearchInput(trimmed);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (trimmed === '') {
      setIsSearching(false);
      setSearch('');
      pushWithParams({
        buildURLParams: ctx.buildURLParams,
        router: ctx.router,
        startTransition: ctx.startTransition,
        params: {
          search: '',
          type: state.type === 'all' ? undefined : state.type,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          page: 1,
          limit: ctx.limit,
          startDate: state.startDate,
          endDate: state.endDate,
        },
      });
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(() => {
      setSearch(trimmed);
      pushWithParams({
        buildURLParams: ctx.buildURLParams,
        router: ctx.router,
        startTransition: ctx.startTransition,
        params: {
          search: trimmed,
          type: state.type === 'all' ? undefined : state.type,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          page: 1,
          limit: ctx.limit,
          startDate: state.startDate,
          endDate: state.endDate,
        },
      });
      setIsSearching(false);
    }, 300);
  };
}

// 辅助：筛选项变更并推送 URL
function applyFilterAndPush(args: {
  key: string;
  value: string | undefined;
  state: {
    type: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    startDate?: string;
    endDate?: string;
    search: string;
  };
  setState: {
    setType: (v: string) => void;
    setSortBy: (v: string) => void;
    setSortOrder: (v: 'asc' | 'desc') => void;
  };
  ctx: {
    buildURLParams: typeof buildStatementsURLParams;
    limit?: number;
    router: ReturnType<typeof useRouter>;
    startTransition: React.TransitionStartFunction;
  };
}) {
  const { key, value, state, setState, ctx } = args;
  const nextType = key === 'type' ? value || 'all' : state.type;
  const nextSortBy = key === 'sortBy' ? value || 'totalAmount' : state.sortBy;
  const nextSortOrder =
    key === 'sortOrder' ? (value as 'asc' | 'desc') || 'desc' : state.sortOrder;

  setState.setType(nextType);
  setState.setSortBy(nextSortBy);
  setState.setSortOrder(nextSortOrder);

  pushWithParams({
    buildURLParams: ctx.buildURLParams,
    router: ctx.router,
    startTransition: ctx.startTransition,
    params: {
      search: state.search,
      type: nextType,
      sortBy: nextSortBy,
      sortOrder: nextSortOrder,
      limit: ctx.limit,
      startDate: state.startDate,
      endDate: state.endDate,
    },
  });
}

// 辅助：日期范围变更并推送 URL
function updateDateRangeAndPush(args: {
  range: { startDate?: string; endDate?: string };
  state: {
    search: string;
    type: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  setDate: {
    setStartDate: (v: string | undefined) => void;
    setEndDate: (v: string | undefined) => void;
  };
  ctx: {
    buildURLParams: typeof buildStatementsURLParams;
    limit?: number;
    router: ReturnType<typeof useRouter>;
    startTransition: React.TransitionStartFunction;
  };
}) {
  const { range, state, setDate, ctx } = args;
  const nextStart = range.startDate || undefined;
  const nextEnd = range.endDate || undefined;

  setDate.setStartDate(nextStart);
  setDate.setEndDate(nextEnd);

  pushWithParams({
    buildURLParams: ctx.buildURLParams,
    router: ctx.router,
    startTransition: ctx.startTransition,
    params: {
      search: state.search,
      type: state.type,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      page: 1,
      limit: ctx.limit,
      startDate: nextStart,
      endDate: nextEnd,
    },
  });
}

// 辅助：创建其余处理器
function createStatementsHandlers(args: {
  type: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
  search: string;
  setType: (v: string) => void;
  setSortBy: (v: string) => void;
  setSortOrder: (v: 'asc' | 'desc') => void;
  setStartDate: (v: string | undefined) => void;
  setEndDate: (v: string | undefined) => void;
  ctx: {
    buildURLParams: typeof buildStatementsURLParams;
    router: ReturnType<typeof useRouter>;
    startTransition: React.TransitionStartFunction;
  };
  limit?: number;
}) {
  const { ctx, limit } = args;

  const handleFilter = (key: string, value: string | undefined) =>
    applyFilterAndPush({
      key,
      value,
      state: {
        type: args.type,
        sortBy: args.sortBy,
        sortOrder: args.sortOrder,
        startDate: args.startDate,
        endDate: args.endDate,
        search: args.search,
      },
      setState: {
        setType: args.setType,
        setSortBy: args.setSortBy,
        setSortOrder: args.setSortOrder,
      },
      ctx,
    });

  const handlePageChange = (page: number) =>
    pushWithParams({
      buildURLParams: ctx.buildURLParams,
      router: ctx.router,
      startTransition: ctx.startTransition,
      params: {
        search: args.search,
        type: args.type,
        sortBy: args.sortBy,
        sortOrder: args.sortOrder,
        page,
        limit,
        startDate: args.startDate,
        endDate: args.endDate,
      },
    });

  const handleDateRangeChange = (range: {
    startDate?: string;
    endDate?: string;
  }) =>
    updateDateRangeAndPush({
      range,
      state: {
        search: args.search,
        type: args.type,
        sortBy: args.sortBy,
        sortOrder: args.sortOrder,
      },
      setDate: { setStartDate: args.setStartDate, setEndDate: args.setEndDate },
      ctx,
    });

  return { handleFilter, handlePageChange, handleDateRangeChange } as const;
}
