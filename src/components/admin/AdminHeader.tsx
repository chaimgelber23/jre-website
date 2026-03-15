"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, LogOut, ExternalLink } from "lucide-react";
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
      <div className="container mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link href="/admin" className="text-lg sm:text-xl font-bold whitespace-nowrap">
            JRE Admin
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {onSync && (
              <motion.button
                onClick={onSync}
                disabled={isSyncing}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#EF8046] rounded-lg text-xs sm:text-sm font-medium hover:bg-[#d96a2f] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync to Sheets"}</span>
                <span className="sm:hidden">{isSyncing ? "..." : "Sync"}</span>
              </motion.button>
            )}
            <Link
              href="/"
              className="text-xs sm:text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5 sm:hidden" />
              <span className="hidden sm:inline">View Site</span>
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5 sm:hidden" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
