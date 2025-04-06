#!/usr/bin/env node

import { Command } from "commander";
import { googleSearch, getGoogleSearchPageHtml } from "./search.js";
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
  .option("--get-html", "Get raw HTML of search result page instead of parsed results / 검색 결과 페이지의 원시 HTML 가져오기")
  .option("--save-html", "Save HTML to file / HTML을 파일로 저장")
  .option("--html-output <path>", "HTML output file path / HTML 출력 파일 경로")
  .action(async (query: string, options: CommandOptions & { getHtml?: boolean, saveHtml?: boolean, htmlOutput?: string }) => {
    try {
      if (options.getHtml) {
        // 获取HTML
        const htmlResult = await getGoogleSearchPageHtml(
          query,
          options,
          options.saveHtml || false,
          options.htmlOutput
        );

        // 如果保存了HTML到文件，在输出中包含文件路径信息
        if (options.saveHtml && htmlResult.savedPath) {
          console.log(`HTML已保存到文件: ${htmlResult.savedPath}`);
        }

        // 输出结果（不包含完整HTML，避免控制台输出过多）
        const outputResult = {
          query: htmlResult.query,
          url: htmlResult.url,
          originalHtmlLength: htmlResult.originalHtmlLength, // 原始HTML长度（包含CSS和JavaScript）
          cleanedHtmlLength: htmlResult.html.length, // 清理后的HTML长度（不包含CSS和JavaScript）
          savedPath: htmlResult.savedPath,
          screenshotPath: htmlResult.screenshotPath, // 网页截图保存路径
          // 只输出HTML的前500个字符作为预览
          htmlPreview: htmlResult.html.substring(0, 500) + (htmlResult.html.length > 500 ? '...' : '')
        };
        
        console.log(JSON.stringify(outputResult, null, 2));
      } else {
        // 执行常规搜索
        const results = await googleSearch(query, options);
        
        // 输出结果
        console.log(JSON.stringify(results, null, 2));
      }
    } catch (error) {
      console.error("错误:", error);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse(process.argv);
