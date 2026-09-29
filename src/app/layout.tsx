import type { Metadata } from "next";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { COMPANY_NAME, COMPANY_TAGLINE } from "@/lib/company";
import "./globals.css";

export const metadata: Metadata = {
  title: `${COMPANY_NAME} — ${COMPANY_TAGLINE}`,
  description:
    "Operational & financial tracking for coal hauling — ritase, HPP, profitabilitas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
