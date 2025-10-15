import "../styles/globals.css";
import Providers from "./providers";
import { IBM_Plex_Mono, Inter, Sora } from "next/font/google";
import AppHeader from "./components/app-header";
import { GoogleTagManager } from "@next/third-parties/google";

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
          <GoogleTagManager gtmId={gtmId} />
        ) : null}
        <Providers isSandbox={isSandbox}>
          <div className="relative flex min-h-screen flex-col">
            <AppHeader />
            <div className="flex-1">
              {children}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}







