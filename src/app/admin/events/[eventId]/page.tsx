"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Users,
  DollarSign,
  Award,
  CheckCircle,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Save,
  Eye,
  EyeOff,
  ExternalLink,
  Plus,
  ChevronDown,
} from "lucide-react";
import StatsCard from "@/components/admin/StatsCard";
import PaymentStatusBadge from "@/components/admin/PaymentStatusBadge";
import type { Event, EventSponsorship, EventRegistration } from "@/types/database";

// Parse the message field which may contain encoded guest data
// Format: JSON { text, guests } when guests exist, plain text otherwise
function parseMessageField(message: string | null): { text: string; guests: { name: string; email?: string }[] } {
  if (!message) return { text: "", guests: [] };
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object" && "guests" in parsed) {
      return { text: parsed.text || "", guests: parsed.guests || [] };
    }
  } catch {
    // Not JSON, treat as plain text
  }
  return { text: message, guests: [] };
}

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

interface EditRegFormData {
  name: string;
  email: string;
  phone: string;
  adults: number;
  kids: number;
  sponsorship_id: string | null;
  subtotal: number;
  payment_status: string;
  message: string;
}

interface EditEventFormData {
  title: string;
  slug: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  location_url: string;
  image_url: string;
  price_per_adult: number;
  kids_price: number;
  is_active: boolean;
}

interface SponsorshipFormItem {
  id?: string;
  name: string;
  price: string;
  description: string;
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<EventDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"registrations" | "sponsorships">(
    "registrations"
  );

  // Edit registration modal state
  const [editingRegistration, setEditingRegistration] =
    useState<EventRegistrationWithSponsorship | null>(null);
  const [editRegForm, setEditRegForm] = useState<EditRegFormData>({
    name: "",
    email: "",
    phone: "",
    adults: 1,
    kids: 0,
    sponsorship_id: null,
    subtotal: 0,
    payment_status: "success",
    message: "",
  });
  const [isSavingReg, setIsSavingReg] = useState(false);
  const [editRegError, setEditRegError] = useState<string | null>(null);

  // Edit event modal state
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editEventForm, setEditEventForm] = useState<EditEventFormData>({
    title: "",
    slug: "",
    description: "",
    date: "",
    start_time: "",
    end_time: "",
    location: "",
    location_url: "",
    image_url: "",
    price_per_adult: 0,
    kids_price: 0,
    is_active: true,
  });
  const [editSponsorships, setEditSponsorships] = useState<SponsorshipFormItem[]>([]);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [editEventError, setEditEventError] = useState<string | null>(null);

  // Expanded registration rows (to show guest details)
  const [expandedRegId, setExpandedRegId] = useState<string | null>(null);

  // Delete registration state
  const [deletingRegId, setDeletingRegId] = useState<string | null>(null);
  const [deletingRegName, setDeletingRegName] = useState<string>("");
  const [isDeletingReg, setIsDeletingReg] = useState(false);

  // Delete event state
  const [showDeleteEvent, setShowDeleteEvent] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchEventDetails = useCallback(async () => {
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
  }, [eventId]);

  useEffect(() => {
    fetchEventDetails();
  }, [fetchEventDetails]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
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

  // === EDIT REGISTRATION ===
  const openEditRegModal = (registration: EventRegistrationWithSponsorship) => {
    setEditingRegistration(registration);
    const { text: msgText } = parseMessageField(registration.message);
    setEditRegForm({
      name: registration.name,
      email: registration.email,
      phone: registration.phone || "",
      adults: registration.adults,
      kids: registration.kids,
      sponsorship_id: registration.sponsorship_id,
      subtotal: registration.subtotal,
      payment_status: registration.payment_status,
      message: msgText,
    });
    setEditRegError(null);
  };

  const handleSaveReg = async () => {
    if (!editingRegistration) return;
    setIsSavingReg(true);
    setEditRegError(null);

    // Re-encode message with guests if they existed in the original
    const { guests: origGuests } = parseMessageField(editingRegistration.message);
    const savedMessage = origGuests.length > 0
      ? JSON.stringify({ text: editRegForm.message || "", guests: origGuests })
      : (editRegForm.message || null);

    try {
      const response = await fetch(
        `/api/admin/registrations/${editingRegistration.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editRegForm.name,
            email: editRegForm.email,
            phone: editRegForm.phone || null,
            adults: editRegForm.adults,
            kids: editRegForm.kids,
            sponsorship_id: editRegForm.sponsorship_id,
            subtotal: editRegForm.subtotal,
            payment_status: editRegForm.payment_status,
            message: savedMessage,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setEditingRegistration(null);
        showToast("Registration updated successfully", "success");
        await fetchEventDetails();
      } else {
        setEditRegError(result.error || "Failed to update");
      }
    } catch {
      setEditRegError("Network error. Please try again.");
    } finally {
      setIsSavingReg(false);
    }
  };

  // === DELETE REGISTRATION ===
  const handleDeleteReg = async () => {
    if (!deletingRegId) return;
    setIsDeletingReg(true);

    try {
      const response = await fetch(
        `/api/admin/registrations/${deletingRegId}`,
        { method: "DELETE" }
      );

      const result = await response.json();
      if (result.success) {
        setDeletingRegId(null);
        showToast("Registration deleted", "success");
        await fetchEventDetails();
      } else {
        showToast(result.error || "Failed to delete", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setIsDeletingReg(false);
    }
  };

  // === EDIT EVENT ===
  const openEditEventModal = () => {
    if (!data) return;
    const { event, sponsorships } = data;
    setEditEventForm({
      title: event.title,
      slug: event.slug,
      description: event.description || "",
      date: event.date,
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      location: event.location || "",
      location_url: event.location_url || "",
      image_url: event.image_url || "",
      price_per_adult: event.price_per_adult,
      kids_price: event.kids_price,
      is_active: event.is_active,
    });
    setEditSponsorships(
      sponsorships.map((s) => ({
        id: s.id,
        name: s.name,
        price: String(s.price),
        description: s.description || "",
      }))
    );
    setEditEventError(null);
    setShowEditEvent(true);
  };

  const handleSaveEvent = async () => {
    setIsSavingEvent(true);
    setEditEventError(null);

    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editEventForm.title,
          slug: editEventForm.slug,
          description: editEventForm.description || null,
          date: editEventForm.date,
          start_time: editEventForm.start_time || null,
          end_time: editEventForm.end_time || null,
          location: editEventForm.location || null,
          location_url: editEventForm.location_url || null,
          image_url: editEventForm.image_url || null,
          price_per_adult: editEventForm.price_per_adult,
          kids_price: editEventForm.kids_price,
          is_active: editEventForm.is_active,
          sponsorships: editSponsorships
            .filter((s) => s.name && s.price)
            .map((s) => ({
              id: s.id || undefined,
              name: s.name,
              price: Number(s.price),
              description: s.description || null,
            })),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setShowEditEvent(false);
        showToast("Event updated successfully", "success");
        await fetchEventDetails();
      } else {
        setEditEventError(result.error || "Failed to update event");
      }
    } catch {
      setEditEventError("Network error. Please try again.");
    } finally {
      setIsSavingEvent(false);
    }
  };

  // === TOGGLE ACTIVE ===
  const handleToggleActive = async () => {
    if (!data) return;
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !data.event.is_active }),
      });
      const result = await response.json();
      if (result.success) {
        showToast(
          data.event.is_active ? "Event deactivated" : "Event activated",
          "success"
        );
        await fetchEventDetails();
      }
    } catch {
      showToast("Failed to update event status", "error");
    }
  };

  // === DELETE EVENT ===
  const handleDeleteEvent = async () => {
    setIsDeletingEvent(true);
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        showToast("Event deleted", "success");
        router.push("/admin/events");
      } else {
        showToast(result.error || "Failed to delete event", "error");
        setShowDeleteEvent(false);
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setIsDeletingEvent(false);
    }
  };

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
        <Link
          href="/admin/events"
          className="text-[#EF8046] hover:underline mt-2 inline-block"
        >
          Back to Events
        </Link>
      </div>
    );
  }

  const { event, sponsorships, registrations, stats } = data;

  const inputClassName =
    "w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm";

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-[60] px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  event.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {event.is_active ? (
                  <>
                    <Eye className="w-3 h-3" /> Live
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3" /> Inactive
                  </>
                )}
              </span>
            </div>
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
              <a
                href={`/events/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#EF8046] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View public page
              </a>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleToggleActive}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                event.is_active
                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  : "bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              {event.is_active ? (
                <>
                  <EyeOff className="w-4 h-4" /> Deactivate
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" /> Activate
                </>
              )}
            </button>
            <button
              onClick={openEditEventModal}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#EF8046] text-white rounded-lg text-sm font-medium hover:bg-[#d96a2f] transition-colors"
            >
              <Pencil className="w-4 h-4" /> Edit Event
            </button>
            <button
              onClick={() => setShowDeleteEvent(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
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

      {/* Registrations Tab */}
      {activeTab === "registrations" ? (
        registrations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-1">No registrations yet</p>
            <p className="text-gray-400 text-sm">
              Registrations will appear here when people sign up at{" "}
              <a
                href={`/events/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#EF8046] hover:underline"
              >
                /events/{event.slug}
              </a>
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendees
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sponsorship
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registered
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registrations.map((reg, index) => {
                    const { text: regMessage, guests: regGuests } = parseMessageField(reg.message);
                    const isExpanded = expandedRegId === reg.id;
                    const hasDetails = regGuests.length > 0 || regMessage;

                    return (
                      <React.Fragment key={reg.id}>
                        <motion.tr
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={`hover:bg-gray-50 transition-colors ${hasDetails ? "cursor-pointer" : ""}`}
                          onClick={() => hasDetails && setExpandedRegId(isExpanded ? null : reg.id)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              {hasDetails && (
                                <ChevronDown
                                  className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                                />
                              )}
                              <div>
                                <p className="font-medium text-gray-900">
                                  {reg.name}
                                </p>
                                <p className="text-gray-500">{reg.email}</p>
                                {reg.phone && (
                                  <p className="text-gray-400 text-xs">{reg.phone}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className="font-medium">{reg.adults}</span> adults
                            {reg.kids > 0 && (
                              <>
                                ,{" "}
                                <span className="font-medium">{reg.kids}</span> kids
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {reg.sponsorship_name ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                <Award className="w-3 h-3 mr-1" />
                                {reg.sponsorship_name}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatCurrency(reg.subtotal)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <PaymentStatusBadge status={reg.payment_status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(reg.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditRegModal(reg); }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-[#EF8046] hover:bg-[#EF8046]/10 transition-colors"
                                title="Edit registration"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingRegId(reg.id);
                                  setDeletingRegName(reg.name);
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete registration"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                        {/* Expanded details row */}
                        <AnimatePresence>
                          {isExpanded && hasDetails && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              <td colSpan={7} className="px-6 py-4 bg-gray-50/50">
                                <div className="pl-6 space-y-3">
                                  {regGuests.length > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                        Guests ({regGuests.length})
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {regGuests.map((guest, gi) => (
                                          <span
                                            key={gi}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm"
                                          >
                                            <Users className="w-3.5 h-3.5 text-[#EF8046]" />
                                            <span className="font-medium text-gray-900">{guest.name}</span>
                                            {guest.email && (
                                              <span className="text-gray-400 text-xs">({guest.email})</span>
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {regMessage && (
                                    <div>
                                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                                        Message
                                      </p>
                                      <p className="text-sm text-gray-700">{regMessage}</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Sponsorships Tab */
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

      {/* ============ EDIT EVENT MODAL ============ */}
      <AnimatePresence>
        {showEditEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !isSavingEvent && setShowEditEvent(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Event
                </h3>
                <button
                  onClick={() => !isSavingEvent && setShowEditEvent(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                {editEventError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {editEventError}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    value={editEventForm.title}
                    onChange={(e) =>
                      setEditEventForm({ ...editEventForm, title: e.target.value })
                    }
                    className={inputClassName}
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={editEventForm.slug}
                    onChange={(e) =>
                      setEditEventForm({ ...editEventForm, slug: e.target.value })
                    }
                    className={inputClassName}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    /events/{editEventForm.slug}
                  </p>
                </div>

                {/* Date & Times */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={editEventForm.date}
                      onChange={(e) =>
                        setEditEventForm({ ...editEventForm, date: e.target.value })
                      }
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={editEventForm.start_time}
                      onChange={(e) =>
                        setEditEventForm({
                          ...editEventForm,
                          start_time: e.target.value,
                        })
                      }
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={editEventForm.end_time}
                      onChange={(e) =>
                        setEditEventForm({
                          ...editEventForm,
                          end_time: e.target.value,
                        })
                      }
                      className={inputClassName}
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editEventForm.location}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        location: e.target.value,
                      })
                    }
                    className={inputClassName}
                    placeholder="JRE - 1495 Weaver Street, Scarsdale"
                  />
                </div>

                {/* Location URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location URL (Google Maps)
                  </label>
                  <input
                    type="url"
                    value={editEventForm.location_url}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        location_url: e.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </div>

                {/* Image URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image URL
                  </label>
                  <input
                    type="text"
                    value={editEventForm.image_url}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        image_url: e.target.value,
                      })
                    }
                    className={inputClassName}
                    placeholder="/images/events/my-event.jpg"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editEventForm.description}
                    onChange={(e) =>
                      setEditEventForm({
                        ...editEventForm,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className={`${inputClassName} resize-none`}
                  />
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price per Adult ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editEventForm.price_per_adult}
                      onChange={(e) =>
                        setEditEventForm({
                          ...editEventForm,
                          price_per_adult: Number(e.target.value) || 0,
                        })
                      }
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price per Kid ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editEventForm.kids_price}
                      onChange={(e) =>
                        setEditEventForm({
                          ...editEventForm,
                          kids_price: Number(e.target.value) || 0,
                        })
                      }
                      className={inputClassName}
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Event Status
                    </p>
                    <p className="text-xs text-gray-500">
                      Inactive events won&apos;t appear on the public site
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditEventForm({
                        ...editEventForm,
                        is_active: !editEventForm.is_active,
                      })
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      editEventForm.is_active ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        editEventForm.is_active
                          ? "translate-x-6"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {/* Sponsorship Tiers */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">
                      Sponsorship Tiers
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditSponsorships([
                          ...editSponsorships,
                          { name: "", price: "", description: "" },
                        ])
                      }
                      className="flex items-center gap-1 text-sm text-[#EF8046] hover:text-[#d96a2f]"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Tier
                    </button>
                  </div>
                  {editSponsorships.length === 0 ? (
                    <p className="text-sm text-gray-400">No sponsorship tiers</p>
                  ) : (
                    <div className="space-y-3">
                      {editSponsorships.map((s, i) => (
                        <div
                          key={i}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={s.name}
                                onChange={(e) => {
                                  const updated = [...editSponsorships];
                                  updated[i].name = e.target.value;
                                  setEditSponsorships(updated);
                                }}
                                className={inputClassName}
                                placeholder="Tier name"
                              />
                              <input
                                type="number"
                                value={s.price}
                                onChange={(e) => {
                                  const updated = [...editSponsorships];
                                  updated[i].price = e.target.value;
                                  setEditSponsorships(updated);
                                }}
                                className={inputClassName}
                                placeholder="Price"
                              />
                              <input
                                type="text"
                                value={s.description}
                                onChange={(e) => {
                                  const updated = [...editSponsorships];
                                  updated[i].description = e.target.value;
                                  setEditSponsorships(updated);
                                }}
                                className={`${inputClassName} col-span-2`}
                                placeholder="Description (optional)"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setEditSponsorships(
                                  editSponsorships.filter((_, idx) => idx !== i)
                                )
                              }
                              className="p-1.5 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  onClick={() => setShowEditEvent(false)}
                  disabled={isSavingEvent}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEvent}
                  disabled={isSavingEvent}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#EF8046] hover:bg-[#d96a2f] rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSavingEvent ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSavingEvent ? "Saving..." : "Save Event"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ EDIT REGISTRATION MODAL ============ */}
      <AnimatePresence>
        {editingRegistration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !isSavingReg && setEditingRegistration(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Registration
                </h3>
                <button
                  onClick={() => !isSavingReg && setEditingRegistration(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {editRegError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {editRegError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editRegForm.name}
                    onChange={(e) =>
                      setEditRegForm({ ...editRegForm, name: e.target.value })
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editRegForm.email}
                    onChange={(e) =>
                      setEditRegForm({ ...editRegForm, email: e.target.value })
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editRegForm.phone}
                    onChange={(e) =>
                      setEditRegForm({ ...editRegForm, phone: e.target.value })
                    }
                    className={inputClassName}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adults
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editRegForm.adults}
                      onChange={(e) =>
                        setEditRegForm({
                          ...editRegForm,
                          adults: parseInt(e.target.value) || 0,
                        })
                      }
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kids
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editRegForm.kids}
                      onChange={(e) =>
                        setEditRegForm({
                          ...editRegForm,
                          kids: parseInt(e.target.value) || 0,
                        })
                      }
                      className={inputClassName}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sponsorship
                  </label>
                  <select
                    value={editRegForm.sponsorship_id || ""}
                    onChange={(e) =>
                      setEditRegForm({
                        ...editRegForm,
                        sponsorship_id: e.target.value || null,
                      })
                    }
                    className={inputClassName}
                  >
                    <option value="">No sponsorship</option>
                    {sponsorships.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - {formatCurrency(s.price)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editRegForm.subtotal}
                    onChange={(e) =>
                      setEditRegForm({
                        ...editRegForm,
                        subtotal: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={editRegForm.payment_status}
                    onChange={(e) =>
                      setEditRegForm({
                        ...editRegForm,
                        payment_status: e.target.value,
                      })
                    }
                    className={inputClassName}
                  >
                    <option value="success">Success</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                {/* Guest names (read-only) */}
                {editingRegistration && (() => {
                  const { guests: editGuests } = parseMessageField(editingRegistration.message);
                  if (editGuests.length === 0) return null;
                  return (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Guests ({editGuests.length})
                      </label>
                      <div className="space-y-1.5">
                        {editGuests.map((guest, gi) => (
                          <div key={gi} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                            <Users className="w-3.5 h-3.5 text-[#EF8046] flex-shrink-0" />
                            <span className="font-medium text-gray-900">{guest.name}</span>
                            {guest.email && (
                              <span className="text-gray-400">({guest.email})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    value={editRegForm.message}
                    onChange={(e) =>
                      setEditRegForm({ ...editRegForm, message: e.target.value })
                    }
                    rows={2}
                    className={`${inputClassName} resize-none`}
                  />
                </div>
              </div>

              <div className="sticky bottom-0 bg-white flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  onClick={() => setEditingRegistration(null)}
                  disabled={isSavingReg}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveReg}
                  disabled={isSavingReg}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#EF8046] hover:bg-[#d96a2f] rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSavingReg ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSavingReg ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ DELETE REGISTRATION MODAL ============ */}
      <AnimatePresence>
        {deletingRegId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !isDeletingReg && setDeletingRegId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete Registration
                </h3>
                <p className="text-sm text-gray-500 mb-1">
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-gray-700">
                    {deletingRegName}
                  </span>
                  &apos;s registration?
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingRegId(null)}
                    disabled={isDeletingReg}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteReg}
                    disabled={isDeletingReg}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isDeletingReg ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ DELETE EVENT MODAL ============ */}
      <AnimatePresence>
        {showDeleteEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !isDeletingEvent && setShowDeleteEvent(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete Event
                </h3>
                <p className="text-sm text-gray-500 mb-1">
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-gray-700">
                    {event.title}
                  </span>
                  ?
                </p>
                <p className="text-sm text-red-500 mb-6">
                  This will permanently delete the event, all {registrations.length}{" "}
                  registration{registrations.length !== 1 ? "s" : ""}, and all
                  sponsorship tiers. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteEvent(false)}
                    disabled={isDeletingEvent}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteEvent}
                    disabled={isDeletingEvent}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isDeletingEvent ? "Deleting..." : "Delete Event"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
