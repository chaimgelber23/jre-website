"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  ChevronDown,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
} from "lucide-react";

interface GuestInfo {
  name: string;
  email?: string;
}

interface EventAttendance {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  registrationDate: string;
  adults: number;
  kids: number;
  subtotal: number;
  paymentStatus: string;
  sponsorshipName: string | null;
  guests: GuestInfo[];
}

interface Person {
  name: string;
  email: string;
  phone: string | null;
  events: EventAttendance[];
  totalSpent: number;
  totalEvents: number;
  lastSeen: string;
}

interface EventInfo {
  id: string;
  title: string;
  date: string;
  slug: string;
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [allEvents, setAllEvents] = useState<EventInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalPeople: 0,
    totalRegistrations: 0,
    totalEvents: 0,
  });

  const fetchPeople = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/people");
      const result = await response.json();
      if (result.success) {
        setPeople(result.people);
        setAllEvents(result.allEvents);
        setStats(result.stats);
      }
    } catch (error) {
      console.error("Failed to fetch people:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (dateString: string) =>
    new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // Filter people by search
  const filteredPeople = people.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q))
    );
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">People</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track everyone who has registered for JRE events
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EF8046]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#EF8046]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalPeople}
              </p>
              <p className="text-xs text-gray-500">Total People</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalRegistrations}
              </p>
              <p className="text-xs text-gray-500">Total Registrations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalEvents}
              </p>
              <p className="text-xs text-gray-500">Events</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
        />
      </div>

      {/* People List */}
      {filteredPeople.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">
            {search ? "No people match your search" : "No people yet"}
          </p>
          <p className="text-gray-400 text-sm">
            People will appear here when they register for events
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Person
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Events Attended
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Spent
                  </th>
                  {allEvents.map((evt) => (
                    <th
                      key={evt.id}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]"
                      title={`${evt.title} - ${formatDate(evt.date)}`}
                    >
                      <div className="truncate max-w-[100px]">{evt.title}</div>
                      <div className="text-[10px] text-gray-400 font-normal normal-case">
                        {formatDate(evt.date)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPeople.map((person, index) => {
                  const isExpanded = expandedEmail === person.email;
                  const attendedEventIds = new Set(
                    person.events.map((e) => e.eventId)
                  );

                  return (
                    <React.Fragment key={person.email}>
                      <motion.tr
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedEmail(isExpanded ? null : person.email)
                        }
                      >
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                            <div>
                              <p className="font-medium text-gray-900">
                                {person.name}
                              </p>
                              <p className="text-gray-500 text-xs flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {person.email}
                              </p>
                              {person.phone && (
                                <p className="text-gray-400 text-xs flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {person.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EF8046]/10 text-[#EF8046] text-xs font-medium">
                            <Calendar className="w-3 h-3" />
                            {person.totalEvents} event
                            {person.totalEvents !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {formatCurrency(person.totalSpent)}
                        </td>
                        {allEvents.map((evt) => (
                          <td
                            key={evt.id}
                            className="px-4 py-4 text-center"
                          >
                            {attendedEventIds.has(evt.id) ? (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-200 mx-auto" />
                            )}
                          </td>
                        ))}
                      </motion.tr>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <td
                              colSpan={3 + allEvents.length}
                              className="px-6 py-4 bg-gray-50/50"
                            >
                              <div className="pl-6 space-y-4">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Registration History
                                </p>
                                <div className="grid gap-3 md:grid-cols-2">
                                  {person.events.map((evt, ei) => (
                                    <div
                                      key={ei}
                                      className="bg-white rounded-lg border border-gray-200 p-4"
                                    >
                                      <div className="flex items-start justify-between mb-2">
                                        <div>
                                          <p className="font-medium text-gray-900 text-sm">
                                            {evt.eventTitle}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {formatDate(evt.eventDate)}
                                          </p>
                                        </div>
                                        <span className="text-sm font-medium text-[#EF8046]">
                                          {formatCurrency(evt.subtotal)}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                        <span>
                                          {evt.adults} adult
                                          {evt.adults !== 1 ? "s" : ""}
                                          {evt.kids > 0
                                            ? `, ${evt.kids} kid${evt.kids !== 1 ? "s" : ""}`
                                            : ""}
                                        </span>
                                        {evt.sponsorshipName && (
                                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                            {evt.sponsorshipName}
                                          </span>
                                        )}
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-xs ${
                                            evt.paymentStatus === "success"
                                              ? "bg-green-100 text-green-700"
                                              : evt.paymentStatus === "pending"
                                              ? "bg-yellow-100 text-yellow-700"
                                              : "bg-red-100 text-red-700"
                                          }`}
                                        >
                                          {evt.paymentStatus}
                                        </span>
                                      </div>
                                      {evt.guests.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                          <p className="text-xs text-gray-400 mb-1">
                                            Guests:
                                          </p>
                                          <div className="flex flex-wrap gap-1">
                                            {evt.guests.map((g, gi) => (
                                              <span
                                                key={gi}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700"
                                              >
                                                <Users className="w-3 h-3 text-[#EF8046]" />
                                                {g.name}
                                                {g.email && (
                                                  <span className="text-gray-400">
                                                    ({g.email})
                                                  </span>
                                                )}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
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
      )}
    </div>
  );
}
