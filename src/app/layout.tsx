import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SaveProvider } from "@/components/editor/SaveContext";
import { Toasts } from "@/components/editor/Toasts";
import { UnloadGuard } from "@/components/editor/UnloadGuard";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BCSFE Web",
  description:
    "Battle Cats save file editor that runs in your browser. A web port of BCSFE-Python by fieryhenry.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SaveProvider>
          {children}
          <Toasts />
          <UnloadGuard />
        </SaveProvider>
      </body>
    </html>
  );
}
