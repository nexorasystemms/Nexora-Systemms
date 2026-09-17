import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/_next",
  "/icon.png",
  "/brand",
  "/portal/login",
  "/portal/register",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // NFR-CORE-04: refresh the session on every request; screens showing borrower data expire
  // after 15 minutes of inactivity — enforced client-side via the session's own expiry plus
  // a re-auth gate on approval/disbursement/unmasking actions (see approver/finance routes).
  const { data: { user } } = await supabase.auth.getUser();

  const isPortalRoute = request.nextUrl.pathname.startsWith("/portal");
  const isBorrower = user?.user_metadata?.role === "borrower";

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    if (isPortalRoute) {
      url.pathname = "/portal/login";
    } else {
      url.pathname = "/login";
      url.searchParams.set("next", request.nextUrl.pathname);
    }
    return NextResponse.redirect(url);
  }

  if (user) {
    // If logged in as borrower, restrict to portal
    if (isBorrower) {
      if (!isPortalRoute || request.nextUrl.pathname === "/portal/login" || request.nextUrl.pathname === "/portal/register") {
        const url = request.nextUrl.clone();
        url.pathname = "/portal";
        url.search = "";
        return NextResponse.redirect(url);
      }
    } else {
      // Staff accounts accessing login pages
      if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/portal/login" || request.nextUrl.pathname === "/portal/register") {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
