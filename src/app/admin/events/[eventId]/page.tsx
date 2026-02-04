"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Award,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import StatsCard from "@/components/admin/StatsCard";
import DataTable from "@/components/admin/DataTable";
import PaymentStatusBadge from "@/components/admin/PaymentStatusBadge";
import type { Event, EventSponsorship, EventRegistration } from "@/types/database";

interface EventRegistrationWithSponsorship extends EventRegistration {
  sponsorship_name: string | null;
}

interface EventDetailData {
  event: Event;
  sponsorships: EventSponsorship[];
  registrations: EventRegistrationWithSponsorship[];
  stats: {
    totalRegistrations: number;
    totalAttendees: number;
    totalAdults: number;
    totalKids: number;
    totalRevenue: number;
    sponsorshipsCount: number;
    sponsorshipRevenue: number;
    failedCount: number;
    pendingCount: number;
    paymentSuccessRate: number;
  };
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const [data, setData] = useState<EventDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"registrations" | "sponsorships">(
    "registrations"
  );

  useEffect(() => {
    const fetchEventDetails = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/events/${eventId}`);
        const result = await response.json();

        if (result.success) {
          setData(result);
        }
      } catch (error) {
        console.error("Failed to fetch event details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventDetails();
  }, [eventId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registrationColumns: {
    key: string;
    header: string;
    render: (item: any) => React.ReactNode;
  }[] = [
    {
      key: "name",
      header: "Attendee",
      render: (item) => (
        <div>
          <p className="font-medium text-gray-900">{item.name}</p>
          <p className="text-sm text-gray-500">{item.email}</p>
        </div>
      ),
    },
    {
      key: "attendees",
      header: "Attendees",
      render: (item) => (
        <div className="text-sm">
          <span className="font-medium">{item.adults}</span> adults
          {item.kids > 0 && (
            <>, <span className="font-medium">{item.kids}</span> kids</>
          )}
        </div>
      ),
    },
    {
      key: "sponsorship",
      header: "Sponsorship",
      render: (item) => (
        <span className="text-sm">
          {item.sponsorship_name ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              <Award className="w-3 h-3 mr-1" />
              {item.sponsorship_name}
            </span>
          ) : (
            "-"
          )}
        </span>
      ),
    },
    {
      key: "subtotal",
      header: "Amount",
      render: (item) => (
        <span className="font-medium text-gray-900">
          {formatCurrency(item.subtotal)}
        </span>
      ),
    },
    {
      key: "payment_status",
      header: "Status",
      render: (item) => (
        <PaymentStatusBadge status={item.payment_status} />
      ),
    },
    {
      key: "created_at",
      header: "Registered",
      render: (item) => (
        <span className="text-sm text-gray-500">
          {formatDateTime(item.created_at)}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-[#EF8046] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium text-gray-900">Event not found</h2>
        <Link href="/admin/events" className="text-[#EF8046] hover:underline mt-2 inline-block">
          Back to Events
        </Link>
      </div>
    );
  }

  const { event, sponsorships, registrations, stats } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDate(event.date)}
          </span>
          {event.start_time && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {event.start_time}
              {event.end_time && ` - ${event.end_time}`}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {event.location}
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Attendees"
          value={stats.totalAttendees}
          subtitle={`${stats.totalAdults} adults, ${stats.totalKids} kids`}
          icon={Users}
        />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
        />
        <StatsCard
          title="Sponsorships"
          value={stats.sponsorshipsCount}
          subtitle={formatCurrency(stats.sponsorshipRevenue)}
          icon={Award}
        />
        <StatsCard
          title="Success Rate"
          value={`${stats.paymentSuccessRate}%`}
          subtitle={
            stats.failedCount > 0
              ? `${stats.failedCount} failed`
              : "All successful"
          }
          icon={stats.failedCount > 0 ? AlertCircle : CheckCircle}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab("registrations")}
            className={`relative py-4 text-sm font-medium transition-colors ${
              activeTab === "registrations"
                ? "text-[#EF8046]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Registrations ({registrations.length})
            {activeTab === "registrations" && (
              <motion.div
                layoutId="activeEventTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EF8046]"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("sponsorships")}
            className={`relative py-4 text-sm font-medium transition-colors ${
              activeTab === "sponsorships"
                ? "text-[#EF8046]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Sponsorships ({sponsorships.length})
            {activeTab === "sponsorships" && (
              <motion.div
                layoutId="activeEventTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EF8046]"
              />
            )}
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "registrations" ? (
        <DataTable
          columns={registrationColumns}
          data={registrations}
          keyField="id"
          emptyMessage="No registrations yet"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sponsorships.length > 0 ? (
            sponsorships.map((sponsorship) => {
              const soldCount = registrations.filter(
                (r) =>
                  r.sponsorship_id === sponsorship.id &&
                  r.payment_status === "success"
              ).length;

              return (
                <motion.div
                  key={sponsorship.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {sponsorship.name}
                      </h3>
                      {sponsorship.description && (
                        <p className="text-sm text-gray-500 mt-1">
                          {sponsorship.description}
                        </p>
                      )}
                    </div>
                    <span className="text-lg font-bold text-[#EF8046]">
                      {formatCurrency(sponsorship.price)}
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                      <span className="font-medium text-gray-900">
                        {soldCount}
                      </span>{" "}
                      sold
                      {sponsorship.max_available && (
                        <> / {sponsorship.max_available} available</>
                      )}
                    </p>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-8 text-gray-500">
              No sponsorship tiers defined for this event
            </div>
          )}
        </div>
      )}
    </div>
  );
}
