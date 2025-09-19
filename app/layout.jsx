import "../styles/globals.css";
import Providers from "./providers";
import Script from "next/script";
import { IBM_Plex_Mono, Roboto } from "next/font/google";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

const gtmId = process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID;

export const metadata = {
  title: "Play Day.AI",
  description: "Create and run your AI-powered role playing experiences.",
};

export default function RootLayout({ children }) {
  const isSandbox = process.env.SANDBOX === "true";

  return (
    <html lang="en" className={`${roboto.variable} ${plexMono.variable}`}>
      <body>
        {gtmId ? (
          <>
            <Script
              id="gtag-src"
              src={`https://www.googletagmanager.com/gtag/js?id=${gtmId}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-inline" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gtmId}');
              `}
            </Script>
          </>
        ) : null}
        <Providers isSandbox={isSandbox}>{children}</Providers>
      </body>
    </html>
  );
}
