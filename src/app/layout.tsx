import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "NAREX Foods — Good Food. Great Taste. Made with Care.",
    template: "%s | NAREX Foods",
  },
  description:
    "Order authentic Ghanaian meals from NAREX Foods in Mampong-Akuapem — signature palava sauce, party jollof, groundnut soup and more. Pickup or delivery, ordered in minutes.",
  keywords: [
    "NAREX Foods", "Ghanaian food", "Mampong-Akuapem", "jollof rice",
    "palava sauce", "food delivery Ghana", "restaurant Akuapem",
  ],
  authors: [{ name: "NAREX Foods" }],
  manifest: "/manifest.webmanifest",
  applicationName: "NAREX Foods",
  icons: {
    icon: [
      { url: "/narex-logo.svg", type: "image/svg+xml" },
      { url: "/narex-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/narex-logo.svg",
  },
  appleWebApp: {
    capable: true,
    title: "NAREX Foods",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "NAREX Foods — Good Food. Great Taste. Made with Care.",
    description:
      "Authentic Ghanaian meals from our kitchen in Mampong-Akuapem. Order online — pickup or delivery.",
    siteName: "NAREX Foods",
    type: "website",
    locale: "en_GH",
    images: [{ url: "/images/hero-1.png", width: 1440, height: 720, alt: "NAREX Foods Ghanaian dishes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NAREX Foods",
    description: "Good Food. Great Taste. Made with Care.",
    images: ["/images/hero-1.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#17362B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
