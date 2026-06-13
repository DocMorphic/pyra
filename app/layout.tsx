import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Body + headings — IBM Plex Sans (PostHog's website typeface).
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Mono — IBM Plex Mono. Micro-labels, codes, tabular numbers.
const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: "Pyra — Solar Plant Intelligence",
  description:
    "A digital-twin O&M console for utility-scale solar. Pyra finds hidden inverter underperformance, quantifies the euros lost, and turns it into an O&M action.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Pyra — Solar Plant Intelligence",
    description: "Find hidden underperformance, quantify the loss, act on it.",
    type: "website",
    images: ["/icon.svg"],
  },
};

// Hardcoded init script — restores theme + accent + brightness from
// localStorage before React hydrates to prevent flash-of-unstyled-content.
// useLocalStorage stores values JSON-stringified, so quotes are stripped.
// No user input crosses this boundary; the literal string is safe to inline.
const FOUC_INIT_SCRIPT = `(function(){try{var s=function(k,d){var v=localStorage.getItem(k);if(v==null)return d;return v.replace(/^"|"$/g,'');};var t=s('pyra:theme','dark');var a=s('pyra:accent','red');var b=s('pyra:brightness','100');var d=document.documentElement;d.setAttribute('data-theme',t);d.setAttribute('data-accent',a);d.style.setProperty('--display-brightness',(parseInt(b,10)/100).toString())}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-accent="red"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: FOUC_INIT_SCRIPT }} />
      </head>
      <body className="h-full overflow-hidden">
        <a href="#desktop-content" className="skip-to-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
