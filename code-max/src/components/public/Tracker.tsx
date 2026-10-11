import Script from "next/script";

/** As páginas públicas usam o mesmo /t.js dos sites de exemplo. */
export function Tracker({ token }: { token: string }) {
  return <Script src="/t.js" data-k={token} strategy="afterInteractive" />;
}
