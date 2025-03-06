#!/usr/bin/env node

import { Command } from "commander";
import { googleSearch } from "./search.js";
import { CommandOptions } from "./types.js";

// 获取包信息
import packageJson from "../package.json" with { type: "json" };

// 创建命令行程序
const program = new Command();

program
  .name("google-search")
  .description("Google Search CLI Tool based on Playwright / Playwright 기반 Google 검색 CLI 도구")
  .version(packageJson.version)
  .argument("<query>", "Search keywords / 검색 키워드")
  .option("-l, --limit <number>", "Result count limit / 결과 수량 제한", parseInt, 10)
  .option("-t, --timeout <number>", "Timeout in milliseconds / 타임아웃(밀리초)", parseInt, 30000)
  .option("--no-headless", "Deprecated: Now always tries headless first, then switches to headed if needed / 헤드리스 모드 끄기(권장하지 않음)")
  .option("--state-file <path>", "Browser state file path / 브라우저 상태 파일 경로", "./browser-state.json")
  .option("--no-save-state", "Don't save browser state / 브라우저 상태 저장하지 않음")
  .option("--locale <string>", "Search result language (default: auto-detect) / 검색 결과 언어", "auto")
  .action(async (query: string, options: CommandOptions) => {
    try {
      // 执行搜索
      const results = await googleSearch(query, options);

      // 输出结果
      console.log(JSON.stringify(results, null, 2));
    } catch (error) {
      console.error("错误:", error);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse(process.argv);
