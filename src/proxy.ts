import { NextResponse, type NextRequest } from "next/server";

// Az alapértelmezett (magyar) nyelv URL-előtag nélkül érhető el; belsőleg a /hu/… útvonalra írjuk át.
// Az angol (/en/…) és a német (/de/…) oldalak előtaggal érkeznek, azokhoz nem nyúlunk (a matcher ki sem választja őket).
// A /hu/… címet a kanonikus előtag nélküli címre irányítjuk, hogy egy oldalnak ne legyen két URL-je.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Kézzel beírt /hu előtag: átirányítás az előtag nélküli kanonikus címre
  if (pathname === "/hu" || pathname.startsWith("/hu/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? "/hu" : `/hu${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Csak a webshop magyar útvonalai (a (main) demóoldalak, az API és a statikus fájlok kimaradnak)
  matcher: [
    "/",
    "/termekek/:path*",
    "/penztar",
    "/aszf",
    "/adatvedelem",
    "/elallas",
    "/impresszum",
    "/fiok",
    "/fiok/:path*",
    "/hirlevel",
    "/hirlevel/:path*",
    "/fizetes/:path*",
    "/hu",
    "/hu/:path*",
  ],
};
