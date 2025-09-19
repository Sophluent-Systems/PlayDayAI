import { NextResponse } from "next/server";
import { auth0, auth0IsSandbox } from "@src/backend/auth0";

const isSandbox = process.env.SANDBOX == 'true';

export async function middleware(request) {
  if (auth0IsSandbox || isSandbox) {
    return NextResponse.next();
  }

  return auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
