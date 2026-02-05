"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar,
  Users,
  DollarSign,
  Plus,
  ChevronRight,
  Folder,
} from "lucide-react";
import StatsCard from "@/components/admin/StatsCard";
import type { Event } from "@/types/database";

interface EventWithStats extends Event {
  stats: {
    totalRegistrations: number;
    totalAttendees: number;
    totalRevenue: number;
    sponsorshipsCount: number;
  };
}

interface EventsData {
  events: EventWithStats[];
  availableYears: number[];
}

export default function AdminEventsPage() {
  const [data, setData] = useState<EventsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const fetchEvents = async (year?: number) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (year) params.append("year", year.toString());

      const response = await fetch(`/api/admin/events?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result);
        // Auto-select the most recent year if none selected
        if (!selectedYear && result.availableYears.length > 0) {
          setSelectedYear(result.availableYears[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(selectedYear || undefined);
  }, [selectedYear]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calculate totals for selected year
  const yearStats = data?.events.reduce(
    (acc, event) => {
      acc.totalEvents += 1;
      acc.totalAttendees += event.stats.totalAttendees;
      acc.totalRevenue += event.stats.totalRevenue;
      return acc;
    },
    { totalEvents: 0, totalAttendees: 0, totalRevenue: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-500">Manage events and view registrations</p>
        </div>
        <Link href="/admin/events/new">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 bg-[#EF8046] text-white rounded-lg font-medium hover:bg-[#d96a2f] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </motion.button>
        </Link>
      </div>

      {/* Year Folders */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Select Year</h3>
        <div className="flex flex-wrap gap-3">
          {(data?.availableYears || [new Date().getFullYear()]).map((year) => (
            <motion.button
              key={year}
              onClick={() => setSelectedYear(year)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                selectedYear === year
                  ? "border-[#EF8046] bg-[#EF8046]/5 text-[#EF8046]"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <Folder
                className={`w-5 h-5 ${
                  selectedYear === year ? "text-[#EF8046]" : "text-gray-400"
                }`}
              />
              <span className="font-medium">{year}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Year Stats */}
      {selectedYear && yearStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title={`Events in ${selectedYear}`}
            value={yearStats.totalEvents}
            icon={Calendar}
          />
          <StatsCard
            title="Total Attendees"
            value={yearStats.totalAttendees}
            icon={Users}
          />
          <StatsCard
            title="Total Revenue"
            value={formatCurrency(yearStats.totalRevenue)}
            icon={DollarSign}
          />
        </div>
      )}

      {/* Events List */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-[#EF8046] border-t-transparent rounded-full mx-auto"
          />
          <p className="text-gray-500 mt-4">Loading events...</p>
        </div>
      ) : data?.events && data.events.length > 0 ? (
        <div className="space-y-4">
          {data.events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link href={`/admin/events/${event.id}`}>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-[#EF8046]/30 transition-all cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#EF8046] transition-colors">
                          {event.title}
                        </h3>
                        {!event.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(event.date)}
                        </span>
                        {event.location && (
                          <span className="truncate max-w-xs">
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">
                          {event.stats.totalAttendees}
                        </p>
                        <p className="text-xs text-gray-500">Attendees</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-[#EF8046]">
                          {formatCurrency(event.stats.totalRevenue)}
                        </p>
                        <p className="text-xs text-gray-500">Revenue</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#EF8046] transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No events yet
          </h3>
          <p className="text-gray-500 mb-4">
            Create your first event to get started
          </p>
          <Link href="/admin/events/new">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#EF8046] text-white rounded-lg font-medium hover:bg-[#d96a2f] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </motion.button>
          </Link>
        </div>
      )}
    </div>
  );
}
