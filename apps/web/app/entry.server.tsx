import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";

// Thời gian tối đa cho phép streaming trước khi huỷ.
export const streamTimeout = 10_000;

/**
 * Điểm vào phía máy chủ. Dùng Web Streams (React 19) nên không phụ thuộc `node:stream`.
 * Với bot tìm kiếm: chờ toàn bộ nội dung (allReady) để HTML đầy đủ phục vụ SEO.
 */
export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
): Promise<Response> {
  let didError = false;

  const userAgent = request.headers.get("user-agent");
  const waitForAll = (userAgent && isbot(userAgent)) || routerContext.isSpaMode;

  const stream = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} />, {
    signal: AbortSignal.timeout(streamTimeout),
    onError(error: unknown) {
      didError = true;
      console.error(error);
    },
  });

  if (waitForAll) {
    await stream.allReady;
  }

  responseHeaders.set("Content-Type", "text/html; charset=utf-8");
  return new Response(stream, {
    status: didError ? 500 : responseStatusCode,
    headers: responseHeaders,
  });
}
