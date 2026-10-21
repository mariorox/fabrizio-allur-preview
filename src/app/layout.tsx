import type { Metadata, Viewport } from "next";
import { EB_Garamond, Jost } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const serif = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-vesto-serif",
  display: "swap",
});

const sans = Jost({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-vesto-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vesto",
  description: "Tailored by technology — prova virtual de tecidos para alfaiataria sob medida",
};

export const viewport: Viewport = {
  themeColor: "#1E1915",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster richColors theme="dark" position="top-center" />
      </body>
    </html>
  );
}
