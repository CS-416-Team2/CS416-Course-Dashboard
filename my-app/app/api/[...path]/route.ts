import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  ForbiddenError,
  UnauthorizedError,
  requireActiveSession,
} from "@/lib/auth/session";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const ALLOWED_SEGMENT = /^[A-Za-z0-9_-]+$/;
const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function validatePathSegments(pathSegments: string[]): boolean {
  return pathSegments.length > 0 && pathSegments.every((segment) => ALLOWED_SEGMENT.test(segment));
}

async function proxyToBackend(request: NextRequest, context: RouteContext) {
  let sessionInfo;
  try {
    sessionInfo = await requireActiveSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  if (!validatePathSegments(path)) {
    return NextResponse.json({ error: "Invalid API path" }, { status: 400 });
  }

  const endpoint = new URL(`/api/${path.join("/")}`, env.BACKEND_API_BASE_URL);
  endpoint.search = request.nextUrl.search;

  const outboundHeaders = new Headers();
  outboundHeaders.set("x-user-id", String(sessionInfo.userId));
  const incomingContentType = request.headers.get("content-type");
  if (incomingContentType) {
    outboundHeaders.set("content-type", incomingContentType);
  }
  const incomingAccept = request.headers.get("accept");
  if (incomingAccept) {
    outboundHeaders.set("accept", incomingAccept);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const body = hasBody ? await request.text() : undefined;

  const upstream = await fetch(endpoint, {
    method: request.method,
    headers: outboundHeaders,
    body,
    cache: "no-store",
  });

  const responseBody = await upstream.text();
  const responseHeaders = new Headers();
  const responseContentType = upstream.headers.get("content-type");
  if (responseContentType) {
    responseHeaders.set("content-type", responseContentType);
  }

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export async function OPTIONS() {
  return NextResponse.json(
    { error: "Method not allowed" },
    {
      status: 405,
      headers: {
        Allow: ALLOWED_METHODS.join(", "),
      },
    },
  );
}
