"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import StatsCard from "@/components/admin/StatsCard";
import DataTable from "@/components/admin/DataTable";
import PaymentStatusBadge from "@/components/admin/PaymentStatusBadge";
import type { Donation } from "@/types/database";

interface DonationsData {
  donations: Donation[];
  stats: {
    totalAmount: number;
    successfulCount: number;
    failedCount: number;
    recurringCount: number;
    recurringTotal: number;
    yearlyTotals: Record<number, number>;
  };
  availableYears: number[];
  pagination: {
    page: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminDonationsPage() {
  const [data, setData] = useState<DonationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);

  const fetchDonations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedYear !== "all") params.append("year", selectedYear);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      if (showRecurringOnly) params.append("recurring", "true");

      const response = await fetch(`/api/admin/donations?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch donations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, [selectedYear, selectedStatus, showRecurringOnly]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const columns = [
    {
      key: "amount",
      header: "Amount",
      render: (item: Donation) => (
        <span className="font-bold text-gray-900">
          {formatCurrency(item.amount)}
        </span>
      ),
    },
    {
      key: "name",
      header: "Donor",
      render: (item: Donation) => (
        <div>
          <p className="font-medium text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-500">{item.email}</p>
        </div>
      ),
    },
    {
      key: "is_recurring",
      header: "Type",
      render: (item: Donation) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            item.is_recurring
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {item.is_recurring ? (
            <>
              <RefreshCw className="w-3 h-3 mr-1" />
              Monthly
            </>
          ) : (
            "One-time"
          )}
        </span>
      ),
    },
    {
      key: "sponsorship",
      header: "Sponsorship",
      render: (item: Donation) => (
        <span className="text-gray-600 text-sm">
          {item.sponsorship || "-"}
        </span>
      ),
    },
    {
      key: "payment_status",
      header: "Status",
      render: (item: Donation) => (
        <PaymentStatusBadge status={item.payment_status} />
      ),
    },
    {
      key: "created_at",
      header: "Date",
      render: (item: Donation) => (
        <span className="text-gray-500 text-sm">
          {formatDate(item.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donations</h1>
          <p className="text-gray-500">Manage and track all donations</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Donations"
          value={formatCurrency(data?.stats.totalAmount || 0)}
          subtitle={`${data?.stats.successfulCount || 0} successful`}
          icon={DollarSign}
        />
        <StatsCard
          title="Successful"
          value={data?.stats.successfulCount || 0}
          icon={CheckCircle}
        />
        <StatsCard
          title="Failed"
          value={data?.stats.failedCount || 0}
          icon={XCircle}
        />
        <StatsCard
          title="Recurring Donors"
          value={data?.stats.recurringCount || 0}
          subtitle={formatCurrency(data?.stats.recurringTotal || 0) + "/month"}
          icon={RefreshCw}
        />
      </div>

      {/* Yearly Totals */}
      {data?.stats.yearlyTotals && Object.keys(data.stats.yearlyTotals).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Yearly Totals
          </h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(data.stats.yearlyTotals)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, total]) => (
                <div
                  key={year}
                  className="bg-[#FBFBFB] rounded-lg px-6 py-4 text-center"
                >
                  <p className="text-sm text-gray-500">{year}</p>
                  <p className="text-xl font-bold text-[#EF8046]">
                    {formatCurrency(total)}
                  </p>
                </div>
              ))}
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#EF8046] focus:ring-1 focus:ring-[#EF8046] outline-none"
          >
            <option value="all">All Years</option>
            {data?.availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#EF8046] focus:ring-1 focus:ring-[#EF8046] outline-none"
          >
            <option value="all">All Status</option>
            <option value="success">Successful</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            id="recurring"
            checked={showRecurringOnly}
            onChange={(e) => setShowRecurringOnly(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-[#EF8046] focus:ring-[#EF8046]"
          />
          <label htmlFor="recurring" className="text-sm text-gray-600">
            Recurring only
          </label>
        </div>
      </div>

      {/* Donations Table */}
      <DataTable
        columns={columns}
        data={data?.donations || []}
        keyField="id"
        isLoading={isLoading}
        emptyMessage="No donations found. Donations will appear here once they are made."
      />
    </div>
  );
}
