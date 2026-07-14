import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PagefindResult = {
  id: string;
  data: () => Promise<{
    url: string;
    meta: {
      title?: string;
      image?: string;
    };
    excerpt: string;
  }>;
};

type PagefindApi = {
  search: (query: string) => Promise<{ results: PagefindResult[] }>;
};

type SearchState = "idle" | "loading" | "ready" | "unavailable";

let pagefindModulePromise: Promise<PagefindApi> | undefined;

function loadPagefind(): Promise<PagefindApi> {
  const pagefindPath = "/pagefind/pagefind.js";
  pagefindModulePromise ??= import(/* @vite-ignore */ pagefindPath) as Promise<PagefindApi>;
  return pagefindModulePromise;
}

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>("idle");
  const [pagefind, setPagefind] = useState<PagefindApi | null>(null);
  const [results, setResults] = useState<
    Array<{ id: string; title: string; url: string; excerpt: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;

    async function initializePagefind() {
      setState("loading");

      try {
        const pagefindApi = await loadPagefind();

        if (!cancelled) {
          setPagefind(pagefindApi);
          setState("ready");
        }
      } catch {
        if (!cancelled) {
          setState("unavailable");
        }
      }
    }

    initializePagefind();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const normalizedQuery = query.trim();

    async function runSearch() {
      if (!pagefind || normalizedQuery.length < 2) {
        setResults([]);
        return;
      }

      const search = await pagefind.search(normalizedQuery);
      const hydratedResults = await Promise.all(
        search.results.slice(0, 8).map(async (result) => {
          const data = await result.data();
          return {
            id: result.id,
            title: data.meta.title ?? data.url,
            url: data.url,
            excerpt: data.excerpt,
          };
        }),
      );

      if (!cancelled) {
        setResults(hydratedResults);
      }
    }

    runSearch();

    return () => {
      cancelled = true;
    };
  }, [pagefind, query]);

  const helperText = useMemo(() => {
    if (state === "loading") {
      return "正在加载搜索索引...";
    }

    if (state === "unavailable") {
      return "开发模式下可能还没有 Pagefind 索引。运行 npm run build 后可在静态站中使用搜索。";
    }

    if (query.trim().length > 0 && query.trim().length < 2) {
      return "请输入至少 2 个字符。";
    }

    if (query.trim().length >= 2 && results.length === 0) {
      return "没有找到匹配内容。";
    }

    return "可以搜索 Codex、EggAi、MCP、Agent 等关键词。";
  }, [query, results.length, state]);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <label className="text-sm font-medium" htmlFor="search-input">
        关键词
      </label>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-wait"
          disabled={state !== "ready"}
          id="search-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索 Codex、EggAi、MCP..."
          type="search"
          value={query}
        />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{helperText}</p>
      <div className="mt-6 space-y-3">
        {results.map((result) => (
          <a
            className="block rounded-md border border-border p-4 transition-colors hover:border-primary/50"
            href={result.url}
            key={result.id}
          >
            <h2 className="text-base font-semibold">{result.title}</h2>
            <p
              className="mt-2 text-sm leading-6 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: result.excerpt }}
            />
          </a>
        ))}
      </div>
    </div>
  );
}
