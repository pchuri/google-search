/**
 * 搜索结果接口
 */
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * 搜索响应接口
 */
export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

/**
 * 命令行选项接口
 */
export interface CommandOptions {
  limit?: number;
  timeout?: number;
  headless?: boolean; // 已废弃，但保留以兼容现有代码
  stateFile?: string;
  noSaveState?: boolean;
  locale?: string; // 검색 결과 언어, 기본값은 자동 감지(auto) 또는 시스템 언어
}
