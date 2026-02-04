"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, RefreshCw, LogOut } from "lucide-react";
import { motion } from "framer-motion";

interface AdminHeaderProps {
  onSync?: () => void;
  isSyncing?: boolean;
}

export default function AdminHeader({ onSync, isSyncing }: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("jre_admin_auth");
    router.push("/admin/login");
  };

  return (
    <header className="bg-[#2d3748] text-white sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-6 h-6 text-[#EF8046]" />
            <Link href="/admin" className="text-xl font-bold">
              JRE Admin
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {onSync && (
              <motion.button
                onClick={onSync}
                disabled={isSyncing}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 bg-[#EF8046] rounded-lg text-sm font-medium hover:bg-[#d96a2f] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync to Sheets"}
              </motion.button>
            )}
            <Link
              href="/"
              className="text-sm text-gray-300 hover:text-white transition-colors"
            >
              View Site
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
