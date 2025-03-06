#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { googleSearch } from "./search.js";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import logger from "./logger.js";
import { chromium, Browser } from "playwright";

// 全局浏览器实例
let globalBrowser: Browser | undefined = undefined;

// 创建MCP服务器实例
const server = new McpServer({
  name: "google-search-server",
  version: "1.0.0",
});

server.tool(
  "google-search",
  "실시간 웹 정보를 검색하기 위해 Google 검색 엔진을 사용하며, 제목, 링크 및 요약이 포함된 검색 결과를 반환합니다. 최신 정보 얻기, 특정 주제에 대한 자료 찾기, 현재 이벤트 연구 또는 사실 확인에 적합합니다. 결과는 JSON 형식으로 반환되며 쿼리 내용과 일치하는 결과 목록이 포함됩니다.",
  {
    query: z
      .string()
      .describe(
        "검색 쿼리 문자열. 최상의 결과를 얻으려면: 1)모호한 문구가 아닌 구체적인 키워드 사용; 2)따옴표\"정확한 문구\"로 강제 일치 가능; 3)site:도메인으로 특정 웹사이트 제한; 4)-제외어로 결과 필터링; 5)OR로 대체어 연결; 6)전문 용어 우선 사용; 7)균형 잡힌 결과를 위해 2-5개 키워드 사용. 예: '기후변화 연구보고서 2024 site:gov -의견' 또는 '\"머신러닝 알고리즘\" 튜토리얼 (Python OR Julia)'"
      ),
    limit: z
      .number()
      .optional()
      .describe("반환할 검색 결과 수 (기본값: 10, 권장 범위: 1-20)"),
    timeout: z
      .number()
      .optional()
      .describe("검색 작업 제한 시간(밀리초) (기본값: 30000, 네트워크 상황에 따라 조정 가능)"),
    locale: z
      .string()
      .optional()
      .describe("검색 결과 언어 (예: ko-KR, en-US, 기본값: 자동 감지)"),
  },
  async (params) => {
    try {
      const { query, limit, timeout } = params;
      logger.info({ query }, "执行Google搜索");

      // 获取用户主目录下的状态文件路径
      const stateFilePath = path.join(
        os.homedir(),
        ".google-search-browser-state.json"
      );
      logger.info({ stateFilePath }, "使用状态文件路径");

      // 检查状态文件是否存在
      const stateFileExists = fs.existsSync(stateFilePath);

      // 初始化警告消息
      let warningMessage = "";

      if (!stateFileExists) {
        warningMessage =
          "⚠️ 注意：浏览器状态文件不存在。首次使用时，如果遇到人机验证，系统会自动切换到有头模式让您完成验证。完成后，系统会保存状态文件，后续搜索将更加顺畅。";
        logger.warn(warningMessage);
      }

      const results = await googleSearch(
        query,
        {
          limit: limit,
          timeout: timeout,
          stateFile: stateFilePath,
          locale: params.locale, // 언어 설정 추가
        },
        globalBrowser
      );

      // 构建返回结果，包含警告信息
      let responseText = JSON.stringify(results, null, 2);
      if (warningMessage) {
        responseText = warningMessage + "\n\n" + responseText;
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      logger.error({ error }, "搜索工具执行错误");

      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `搜索失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// 启动服务器
async function main() {
  try {
    logger.info("正在启动Google搜索MCP服务器...");

    // 初始化全局浏览器实例
    logger.info("正在初始化全局浏览器实例...");
    globalBrowser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-site-isolation-trials",
        "--disable-web-security",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--hide-scrollbars",
        "--mute-audio",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-component-extensions-with-background-pages",
        "--disable-extensions",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--disable-renderer-backgrounding",
        "--enable-features=NetworkService,NetworkServiceInProcess",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
    logger.info("全局浏览器实例初始化成功");

    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("Google搜索MCP服务器已启动，等待连接...");

    // 设置进程退出时的清理函数
    process.on("exit", async () => {
      await cleanupBrowser();
    });

    // 处理Ctrl+C (Windows和Unix/Linux)
    process.on("SIGINT", async () => {
      logger.info("收到SIGINT信号，正在关闭服务器...");
      await cleanupBrowser();
      process.exit(0);
    });

    // 处理进程终止 (Unix/Linux)
    process.on("SIGTERM", async () => {
      logger.info("收到SIGTERM信号，正在关闭服务器...");
      await cleanupBrowser();
      process.exit(0);
    });

    // Windows特定处理
    if (process.platform === "win32") {
      // 处理Windows的CTRL_CLOSE_EVENT、CTRL_LOGOFF_EVENT和CTRL_SHUTDOWN_EVENT
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.on("SIGINT", async () => {
        logger.info("Windows: 收到SIGINT信号，正在关闭服务器...");
        await cleanupBrowser();
        process.exit(0);
      });
    }
  } catch (error) {
    logger.error({ error }, "服务器启动失败");
    await cleanupBrowser();
    process.exit(1);
  }
}

// 清理浏览器资源
async function cleanupBrowser() {
  if (globalBrowser) {
    logger.info("正在关闭全局浏览器实例...");
    try {
      await globalBrowser.close();
      globalBrowser = undefined;
      logger.info("全局浏览器实例已关闭");
    } catch (error) {
      logger.error({ error }, "关闭浏览器实例时发生错误");
    }
  }
}

main();
