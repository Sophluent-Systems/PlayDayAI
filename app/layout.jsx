import "../styles/globals.css";
import Providers from "./providers";
import Script from "next/script";
import { UserProfileMenu } from "@src/client/components/userprofilemenu";
import GameMenu from "@src/client/components/gamemenu";
import { IBM_Plex_Mono, Inter, Sora } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

const gtmId = process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID;

export const metadata = {
  title: "Play Day.AI",
  description: "Create and run your AI-powered role playing experiences.",
};

export default function RootLayout({ children }) {
  const isSandbox = process.env.SANDBOX === "true";

  return (
    <html
      lang="en"
      className={[inter.variable, sora.variable, plexMono.variable].join(" ")}
      suppressHydrationWarning
    >
      <body className="relative min-h-screen bg-background text-emphasis">
        {gtmId ? (
          <>
            <Script
              id="gtag-src"
              src={"https://www.googletagmanager.com/gtag/js?id=" + gtmId}
              strategy="afterInteractive"
            />
            <Script
              id="gtag-inline"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: [
                  "window.dataLayer = window.dataLayer || [];",
                  "function gtag(){dataLayer.push(arguments);}",
                  "gtag('js', new Date());",
                  "gtag('config', '" + gtmId + "');",
                ].join("\n"),
              }}
            />
          </>
        ) : null}
        <Providers isSandbox={isSandbox}>
          <div className="relative flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 pointer-events-none">
              <div className="pointer-events-auto mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-8 lg:px-12">
                <div className="pointer-events-auto">
                  <div className="group/gear inline-flex">
                    <div className="inline-flex h-11 items-center justify-center gap-0 rounded-full border border-border/50 bg-surface/95 px-2 text-muted shadow-soft transition-all duration-300 ease-out group-hover/gear:gap-3 group-hover/gear:justify-start group-hover/gear:border-primary/60 group-hover/gear:px-4 group-hover/gear:text-primary group-focus-within/gear:justify-start">
                      <GameMenu
                        placement="inline"
                        allowEditOptions
                        includePlayOption
                        className="!h-9 !w-9 !rounded-full !border-none !bg-transparent !text-current !shadow-none !hover:translate-y-0 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      />
                      <span className="pointer-events-none hidden whitespace-nowrap text-xs font-semibold uppercase tracking-wide transition-all duration-200 ease-out group-focus-within/gear:inline group-hover/gear:inline">Project menu</span>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-auto">
                  <UserProfileMenu variant="bug" />
                </div>
              </div>
            </header>
            <div className="flex-1">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}

