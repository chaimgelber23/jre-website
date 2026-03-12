"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, ImageIcon, FolderOpen, CheckCircle, AlertCircle, Trash2 } from "lucide-react";

interface SyncResult {
  success: boolean;
  folders?: number;
  totalInserted?: number;
  totalSkipped?: number;
  categories?: Record<string, { added: number; skipped: number; total: number }>;
  error?: string;
}

interface GalleryStats {
  totalPhotos: number;
  categories: { name: string; count: number }[];
}

export default function AdminGalleryPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [stats, setStats] = useState<GalleryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/gallery");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch gallery stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/gallery", { method: "POST" });
      const data = await res.json();
      setSyncResult(data);
      if (data.success) {
        fetchStats(); // Refresh stats after sync
      }
    } catch (err) {
      setSyncResult({ success: false, error: "Failed to connect to sync endpoint" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to remove ALL gallery photos from the database? This won't delete the actual files in Google Drive.")) {
      return;
    }
    try {
      const res = await fetch("/api/admin/gallery", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setStats({ totalPhotos: 0, categories: [] });
        setSyncResult(null);
      }
    } catch (err) {
      console.error("Failed to clear gallery:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gallery</h1>
          <p className="text-gray-500">
            Sync photos from Google Drive to the gallery page
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#EF8046]/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-[#EF8046]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Photos</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? "..." : stats?.totalPhotos || 0}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Categories</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? "..." : stats?.categories?.length || 0}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-center"
        >
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-3 px-6 py-3 bg-[#EF8046] text-white rounded-xl font-medium hover:bg-[#d96a2f] disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync from Google Drive"}
          </button>
        </motion.div>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-5 border ${
            syncResult.success
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {syncResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div>
              {syncResult.success ? (
                <>
                  <p className="font-medium text-green-800">
                    Sync complete!
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    {syncResult.totalInserted} new photos added, {syncResult.totalSkipped} already existed
                    {syncResult.folders ? ` across ${syncResult.folders} folders` : ""}
                  </p>
                  {syncResult.categories && Object.keys(syncResult.categories).length > 0 && (
                    <div className="mt-3 space-y-1">
                      {Object.entries(syncResult.categories).map(([name, stat]) => (
                        <p key={name} className="text-sm text-green-700">
                          <span className="font-medium">{name}:</span>{" "}
                          {stat.total} photos found
                          {stat.added > 0 ? `, ${stat.added} new` : ""}
                          {stat.skipped > 0 ? `, ${stat.skipped} already synced` : ""}
                          {stat.total === 0 ? " — no images found in this folder" : ""}
                        </p>
                      ))}
                    </div>
                  )}
                  {syncResult.folders === 0 && (
                    <p className="text-sm text-yellow-700 mt-2">⚠️ No folders were discovered. Check that your Drive folder is shared with the service account.</p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium text-red-800">Sync failed</p>
                  <p className="text-sm text-red-700 mt-1">
                    {syncResult.error}
                  </p>
                  {syncResult.error?.includes("Drive API") && (
                    <p className="text-sm text-red-600 mt-2">
                      Enable the Google Drive API at:{" "}
                      <a
                        href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Google Cloud Console
                      </a>
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Categories Breakdown */}
      {stats && stats.categories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Photos by Category
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.categories.map((cat) => (
              <div
                key={cat.name}
                className="flex items-center justify-between bg-[#FBFBFB] rounded-lg px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-700">
                  {cat.name}
                </span>
                <span className="text-sm font-bold text-[#EF8046]">
                  {cat.count} photos
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Danger Zone */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-red-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Danger Zone
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Clear all gallery photos from the database. This won&apos;t affect your Google Drive files.
          You can re-sync after clearing.
        </p>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Gallery Photos
        </button>
      </div>
    </div>
  );
}
