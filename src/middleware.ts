import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth", "/_next", "/favicon.ico", "/brand", "/portal/login", "/portal/register"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isPortalPath(pathname: string) {
  return pathname === "/portal" || pathname.startsWith("/portal/");
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

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = isPortalPath(request.nextUrl.pathname) ? "/portal/login" : "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // The `error` check below matters: requireStaff()/requireRole() (src/lib/current-staff.ts)
  // redirect a *signed-in* user back to /login?error=... when there's no matching public.users
  // row, or it's inactive. Without this check, an authenticated-but-unprovisioned user bounces
  // forever between "/" (requireStaff sends them to /login) and "/login" (this middleware sends
  // them straight back to "/") — Chrome's own "Throttling navigation" protection is what a user
  // actually sees when that happens, not a rendering bug.
  if (user && request.nextUrl.pathname === "/login" && !request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // /portal/register is deliberately excluded here — requireBorrower() (src/lib/current-borrower.ts)
  // sends a signed-in user with no applicants row there, and bouncing them back out on every
  // request would create the same infinite-redirect failure mode as above.
  if (user && request.nextUrl.pathname === "/portal/login" && !request.nextUrl.searchParams.has("error")) {
    const url = request.nextUrl.clone();
    url.pathname = "/portal";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
