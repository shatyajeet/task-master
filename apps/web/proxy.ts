import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 runs this before every route (it replaced middleware.ts). It is the local-only
// Host check: a request for any other Host, such as a DNS-rebinding attack, gets 403.
const ALLOWED_HOSTS = new Set(["localhost:3000", "127.0.0.1:3000"]);

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase();
  if (host === undefined || !ALLOWED_HOSTS.has(host)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}
