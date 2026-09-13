import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { StoreProvider } from "@/store";

import "@/app/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  icons: { icon: "/icon.svg" },
  title: {
    default: "Drive - Your personal cloud workspace",
    template: "%s - Drive",
  },
  description:
    "A thoughtful, open-source home for your files. Organize, preview, and share with Drive, your own private cloud workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <StoreProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </StoreProvider>
      </body>
    </html>
  );
}
