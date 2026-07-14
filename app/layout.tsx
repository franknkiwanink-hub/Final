import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import NavDrawer from "@/components/layout/NavDrawer";
import BottomNav from "@/components/layout/BottomNav";
import AnnouncementBar from "@/components/layout/AnnouncementBar";
import { AuthProvider } from "@/lib/AuthContext";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";

export const metadata: Metadata = {
  title: "Siterifty — Buy & Sell Websites, Apps & Games for Indie & Small Developers",
  description:
    "Siterifty is a secure, escrow-protected marketplace built for indie and small developers buying and selling websites, apps, and games. Browse profitable listings or list your own — safe, verified deals from start to finish.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthModalProvider>
            <Header />
            <div id="navOverlay" />
            <NavDrawer />
            <AnnouncementBar />
            <main>{children}</main>
            <BottomNav />
          </AuthModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
