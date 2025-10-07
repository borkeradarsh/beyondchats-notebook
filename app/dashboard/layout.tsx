import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - BeyondChats",
  description: "Your AI-powered notebook dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}