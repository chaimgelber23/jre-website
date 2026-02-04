"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface Sponsorship {
  name: string;
  price: string;
  description: string;
}

export default function NewEventPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    locationUrl: "",
    pricePerAdult: "",
    kidsPrice: "0",
    description: "",
    imageUrl: "",
  });
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-generate slug from title
    if (name === "title") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const addSponsorship = () => {
    setSponsorships([...sponsorships, { name: "", price: "", description: "" }]);
  };

  const updateSponsorship = (
    index: number,
    field: keyof Sponsorship,
    value: string
  ) => {
    const updated = [...sponsorships];
    updated[index][field] = value;
    setSponsorships(updated);
  };

  const removeSponsorship = (index: number) => {
    setSponsorships(sponsorships.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          pricePerAdult: Number(formData.pricePerAdult) || 0,
          kidsPrice: Number(formData.kidsPrice) || 0,
          sponsorships: sponsorships
            .filter((s) => s.name && s.price)
            .map((s) => ({
              name: s.name,
              price: Number(s.price),
              description: s.description || null,
            })),
        }),
      });

      const result = await response.json();

      if (result.success) {
        router.push("/admin/events");
      } else {
        alert(result.error || "Failed to create event");
      }
    } catch (error) {
      console.error("Failed to create event:", error);
      alert("Failed to create event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Event</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Event Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                placeholder="e.g., Chanukah Celebration 2025"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Slug *
              </label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                placeholder="chanukah-2025"
              />
              <p className="text-xs text-gray-500 mt-1">
                URL will be: /events/{formData.slug || "event-slug"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                placeholder="JRE - 1495 Weaver Street, Scarsdale"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location URL (Google Maps)
              </label>
              <input
                type="url"
                name="locationUrl"
                value={formData.locationUrl}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                placeholder="https://maps.google.com/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none resize-none"
                placeholder="Describe the event..."
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price per Adult ($)
              </label>
              <input
                type="number"
                name="pricePerAdult"
                value={formData.pricePerAdult}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                placeholder="36"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price per Kid ($)
              </label>
              <input
                type="number"
                name="kidsPrice"
                value={formData.kidsPrice}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Sponsorships */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Sponsorship Tiers
            </h2>
            <button
              type="button"
              onClick={addSponsorship}
              className="flex items-center gap-2 text-sm text-[#EF8046] hover:text-[#d96a2f]"
            >
              <Plus className="w-4 h-4" />
              Add Tier
            </button>
          </div>

          {sponsorships.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No sponsorship tiers added. Click &quot;Add Tier&quot; to create one.
            </p>
          ) : (
            <div className="space-y-4">
              {sponsorships.map((sponsorship, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          value={sponsorship.name}
                          onChange={(e) =>
                            updateSponsorship(index, "name", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded border border-gray-200 text-sm focus:border-[#EF8046] outline-none"
                          placeholder="Gold Sponsor"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Price ($)
                        </label>
                        <input
                          type="number"
                          value={sponsorship.price}
                          onChange={(e) =>
                            updateSponsorship(index, "price", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded border border-gray-200 text-sm focus:border-[#EF8046] outline-none"
                          placeholder="500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Description (optional)
                        </label>
                        <input
                          type="text"
                          value={sponsorship.description}
                          onChange={(e) =>
                            updateSponsorship(index, "description", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded border border-gray-200 text-sm focus:border-[#EF8046] outline-none"
                          placeholder="Includes premium seating and recognition"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSponsorship(index)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link
            href="/admin/events"
            className="px-6 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-2 bg-[#EF8046] text-white rounded-lg font-medium hover:bg-[#d96a2f] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Event"}
          </motion.button>
        </div>
      </form>
    </div>
  );
}
