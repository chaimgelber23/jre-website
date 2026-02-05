"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
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
} from "lucide-react";
import StatsCard from "@/components/admin/StatsCard";
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

interface EditFormData {
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

  // Edit modal state
  const [editingRegistration, setEditingRegistration] =
    useState<EventRegistrationWithSponsorship | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
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
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Open edit modal
  const openEditModal = (registration: EventRegistrationWithSponsorship) => {
    setEditingRegistration(registration);
    setEditForm({
      name: registration.name,
      email: registration.email,
      phone: registration.phone || "",
      adults: registration.adults,
      kids: registration.kids,
      sponsorship_id: registration.sponsorship_id,
      subtotal: registration.subtotal,
      payment_status: registration.payment_status,
      message: registration.message || "",
    });
    setEditError(null);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingRegistration) return;
    setIsSaving(true);
    setEditError(null);

    try {
      const response = await fetch(
        `/api/admin/registrations/${editingRegistration.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editForm.name,
            email: editForm.email,
            phone: editForm.phone || null,
            adults: editForm.adults,
            kids: editForm.kids,
            sponsorship_id: editForm.sponsorship_id,
            subtotal: editForm.subtotal,
            payment_status: editForm.payment_status,
            message: editForm.message || null,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setEditingRegistration(null);
        showToast("Registration updated successfully", "success");
        await fetchEventDetails();
      } else {
        setEditError(result.error || "Failed to update");
      }
    } catch {
      setEditError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm delete
  const confirmDelete = (reg: EventRegistrationWithSponsorship) => {
    setDeletingId(reg.id);
    setDeletingName(reg.name);
  };

  // Delete registration
  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/admin/registrations/${deletingId}`,
        { method: "DELETE" }
      );

      const result = await response.json();
      if (result.success) {
        setDeletingId(null);
        showToast("Registration deleted", "success");
        await fetchEventDetails();
      } else {
        showToast(result.error || "Failed to delete", "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setIsDeleting(false);
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

      {/* Registrations Tab */}
      {activeTab === "registrations" ? (
        registrations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-gray-500">No registrations yet</p>
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
                  {registrations.map((reg, index) => (
                    <motion.tr
                      key={reg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>
                          <p className="font-medium text-gray-900">
                            {reg.name}
                          </p>
                          <p className="text-gray-500">{reg.email}</p>
                          {reg.phone && (
                            <p className="text-gray-400 text-xs">{reg.phone}</p>
                          )}
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
                            onClick={() => openEditModal(reg)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#EF8046] hover:bg-[#EF8046]/10 transition-colors"
                            title="Edit registration"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmDelete(reg)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete registration"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
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

      {/* Edit Registration Modal */}
      <AnimatePresence>
        {editingRegistration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !isSaving && setEditingRegistration(null)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-100 z-10">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Registration
                </h3>
                <button
                  onClick={() => !isSaving && setEditingRegistration(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-5 space-y-4">
                {editError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {editError}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className={inputClassName}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    className={inputClassName}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                    className={inputClassName}
                  />
                </div>

                {/* Adults & Kids */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adults
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.adults}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
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
                      value={editForm.kids}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          kids: parseInt(e.target.value) || 0,
                        })
                      }
                      className={inputClassName}
                    />
                  </div>
                </div>

                {/* Sponsorship */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sponsorship
                  </label>
                  <select
                    value={editForm.sponsorship_id || ""}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
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

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.subtotal}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        subtotal: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={inputClassName}
                  />
                </div>

                {/* Payment Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={editForm.payment_status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
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

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    value={editForm.message}
                    onChange={(e) =>
                      setEditForm({ ...editForm, message: e.target.value })
                    }
                    rows={2}
                    className={`${inputClassName} resize-none`}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  onClick={() => setEditingRegistration(null)}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#EF8046] hover:bg-[#d96a2f] rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
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
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !isDeleting && setDeletingId(null)}
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
                    {deletingName}
                  </span>
                  &apos;s registration?
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  This will remove them from the event and update all counts.
                  This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeletingId(null)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
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
