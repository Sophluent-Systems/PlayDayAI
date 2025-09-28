import "../styles/globals.css";
import Providers from "./providers";
import Script from "next/script";
import { UserProfileMenu } from "@src/client/components/userprofilemenu";
import { ProjectMenuLauncher } from "@src/client/components/projectmenulauncher";
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
            <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
              <div className="pointer-events-auto mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-8 lg:px-12">
                <div className="pointer-events-auto">
                  <ProjectMenuLauncher placement="inline" allowEditOptions includePlayOption />
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


