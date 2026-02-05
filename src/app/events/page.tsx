"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  Star,
  ChevronDown,
  Loader2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { FadeUp, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import type { Event } from "@/types/database";

interface DisplayEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  price: number;
  image: string;
  description: string;
  featured: boolean;
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatEventTime(startTime: string | null, endTime: string | null): string {
  if (!startTime) return "See event details";
  const start = startTime;
  if (endTime) return `${start} - ${endTime}`;
  return start;
}

function eventToDisplay(event: Event, isFeatured: boolean): DisplayEvent {
  return {
    id: event.slug,
    title: event.title,
    date: formatEventDate(event.date),
    time: formatEventTime(event.start_time, event.end_time),
    location: event.location || "See event details",
    price: event.price_per_adult,
    image: event.image_url || "/images/events/Dinner.jpg",
    description: event.description || "",
    featured: isFeatured,
  };
}

// Subtle decorative shape component
function DecorativeShape({
  className,
  delay = 0,
}: {
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, delay }}
    />
  );
}

// Event Card Component with enhanced animations
function EventCard({
  event,
  index,
}: {
  event: DisplayEvent;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <Link href={`/events/${event.id}`} className="block group">
        <motion.div
          whileHover={{ y: -8, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow cursor-pointer w-[350px] flex flex-col relative"
        >
          {/* Gradient border effect on hover */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#EF8046] via-[#f59e0b] to-[#EF8046] opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm scale-[1.02]" />

          <div className="relative h-52 overflow-hidden">
            <Image
              src={event.image}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {event.featured && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute top-4 left-0 bg-[#EF8046] text-white px-4 py-2 rounded-r-full text-sm font-bold uppercase tracking-wide shadow-lg flex items-center gap-2"
              >
                <Star className="w-4 h-4 fill-current" />
                Next Event
              </motion.div>
            )}
          </div>

          <div className="p-6 flex-grow flex flex-col bg-white relative">
            <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#EF8046] transition-colors">
              {event.title}
            </h3>
            <p className="text-gray-600 mb-4 flex-grow line-clamp-2">
              {event.description}
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EF8046]/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-[#EF8046]" />
                </div>
                <span>{event.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EF8046]/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-[#EF8046]" />
                </div>
                <span>{event.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EF8046]/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-[#EF8046]" />
                </div>
                <span className="truncate">{event.location}</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <motion.span
                className="text-[#EF8046] font-semibold flex items-center gap-2"
                whileHover={{ x: 5 }}
              >
                Register Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
              </motion.span>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// Featured Event Spotlight Component
function FeaturedEventSpotlight({ event }: { event: DisplayEvent }) {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2d3748] via-[#1a202c] to-[#2d3748]" />

      {/* Subtle decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <DecorativeShape
          className="absolute top-10 left-10 w-64 h-64 bg-[#EF8046]/10 rounded-full blur-3xl"
          delay={0}
        />
        <DecorativeShape
          className="absolute bottom-10 right-10 w-80 h-80 bg-[#EF8046]/8 rounded-full blur-3xl"
          delay={0.3}
        />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-[#EF8046]/20 text-[#EF8046] px-4 py-2 rounded-full mb-4"
          >
            <Star className="w-4 h-4 fill-current" />
            <span className="font-semibold text-sm uppercase tracking-wider">
              Don&apos;t Miss Out
            </span>
            <Star className="w-4 h-4 fill-current" />
          </motion.div>
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Our Next Event
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 items-center max-w-6xl mx-auto">
          {/* Image side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="relative h-[400px] rounded-2xl overflow-hidden group">
              <Image
                src={event.image}
                alt={event.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Animated border */}
              <div className="absolute inset-0 rounded-2xl border-2 border-[#EF8046]/50 group-hover:border-[#EF8046] transition-colors" />

              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#EF8046] rounded-tl-2xl" />
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#EF8046] rounded-br-2xl" />
            </div>
          </motion.div>

          {/* Content side */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white"
          >
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              {event.title}
            </h3>
            <p className="text-gray-300 text-lg mb-8 leading-relaxed">
              {event.description}
            </p>

            <div className="space-y-4 mb-8">
              <motion.div
                className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4"
                whileHover={{
                  x: 10,
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-12 h-12 bg-[#EF8046] rounded-xl flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Date</p>
                  <p className="font-semibold">{event.date}</p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4"
                whileHover={{
                  x: 10,
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-12 h-12 bg-[#EF8046] rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Time</p>
                  <p className="font-semibold">{event.time}</p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-4"
                whileHover={{
                  x: 10,
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
                transition={{ duration: 0.2 }}
              >
                <div className="w-12 h-12 bg-[#EF8046] rounded-xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Location</p>
                  <p className="font-semibold">{event.location}</p>
                </div>
              </motion.div>
            </div>

            <Link href={`/events/${event.id}`}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-[#EF8046] to-[#f59e0b] text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg shadow-[#EF8046]/30 flex items-center gap-3 group"
              >
                Register Now
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.span>
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default function EventsPage() {
  const [upcomingEvents, setUpcomingEvents] = useState<DisplayEvent[]>([]);
  const [pastEvents, setPastEvents] = useState<DisplayEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();

        if (data.success) {
          const upcoming: Event[] = data.upcoming || [];
          const past: Event[] = data.past || [];

          // First upcoming event is featured
          const displayUpcoming = upcoming.map((e, i) =>
            eventToDisplay(e, i === 0)
          );
          const displayPast = past.map((e) => eventToDisplay(e, false));

          setUpcomingEvents(displayUpcoming);
          setPastEvents(displayPast);
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchEvents();
  }, []);

  const featuredEvent = upcomingEvents.find((e) => e.featured);
  const otherEvents = upcomingEvents.filter((e) => !e.featured);

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="w-10 h-10 text-[#EF8046] animate-spin" />
            <p className="text-gray-500">Loading events...</p>
          </motion.div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero Section - Clean and Professional */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background gradient - warm orange */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#EF8046] via-[#e8733a] to-[#d96a2f]" />

        {/* Subtle decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <DecorativeShape
            className="absolute -top-20 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl"
            delay={0}
          />
          <DecorativeShape
            className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-white/5 rounded-full blur-3xl"
            delay={0.2}
          />
        </div>

        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-white/80 font-medium tracking-wider uppercase mb-4"
          >
            Join Us
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-5xl md:text-6xl font-bold mb-6 text-white"
          >
            Upcoming Events
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xl text-white/90 max-w-2xl mx-auto"
          >
            Great people, great food, and meaningful Torah—we&apos;d love to see
            you!
          </motion.p>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12"
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="inline-flex flex-col items-center gap-1 text-white/60"
            >
              <span className="text-xs uppercase tracking-widest">
                See What&apos;s Coming
              </span>
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Featured Event Spotlight */}
      {featuredEvent && <FeaturedEventSpotlight event={featuredEvent} />}

      {/* Other Upcoming Events */}
      {otherEvents.length > 0 && (
        <section className="py-20 bg-white relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#EF8046]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#EF8046]/5 rounded-full blur-3xl" />

          <div className="container mx-auto px-6 relative z-10">
            <FadeUp className="text-center mb-12">
              <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-3">
                Mark Your Calendar
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
                More Events
              </h2>
            </FadeUp>

            <div className="flex flex-wrap justify-center gap-8">
              {otherEvents.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* No events message */}
      {upcomingEvents.length === 0 && !isLoading && (
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6 text-center">
            <FadeUp>
              <div className="max-w-lg mx-auto">
                <Calendar className="w-16 h-16 text-[#EF8046]/40 mx-auto mb-6" />
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Stay Tuned!
                </h2>
                <p className="text-gray-600 text-lg">
                  We&apos;re planning exciting new events. Join our mailing list
                  to be the first to know!
                </p>
                <Link href="/contact">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-8 bg-[#EF8046] text-white px-8 py-4 rounded font-medium hover:bg-[#d96a2f]"
                  >
                    Get in Touch
                  </motion.button>
                </Link>
              </div>
            </FadeUp>
          </div>
        </section>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <section className="py-20 bg-[#FBFBFB] relative overflow-hidden">
          {/* Decorative line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#EF8046]/30 to-transparent" />

          <div className="container mx-auto px-6">
            <FadeUp className="text-center mb-12">
              <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-3">
                Memories
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
                Past Events
              </h2>
            </FadeUp>

            <StaggerContainer className="flex flex-wrap justify-center gap-6">
              {pastEvents.map((event, index) => (
                <StaggerItem key={event.id}>
                  <motion.div
                    whileHover={{ y: -10, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="relative h-72 w-[350px] rounded-2xl overflow-hidden group cursor-pointer"
                  >
                    <Image
                      src={event.image}
                      alt={event.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-[#EF8046]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <motion.p
                        className="text-[#EF8046] text-sm font-semibold mb-2"
                        initial={{ y: 10, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        {event.date}
                      </motion.p>
                      <h3 className="text-xl font-bold text-white group-hover:text-[#EF8046] transition-colors">
                        {event.title}
                      </h3>
                    </div>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-[#EF8046] relative overflow-hidden">
        {/* Subtle decorative shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <DecorativeShape
            className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"
            delay={0}
          />
          <DecorativeShape
            className="absolute bottom-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl"
            delay={0.2}
          />
        </div>

        <div className="container mx-auto px-6 text-center relative z-10">
          <FadeUp>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Don&apos;t Miss Out!
            </h2>
            <p className="text-white/90 text-lg max-w-2xl mx-auto mb-10">
              Join our mailing list to stay updated on upcoming events and never
              miss an opportunity to connect.
            </p>
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white text-[#EF8046] px-8 py-4 rounded font-medium text-lg shadow-lg"
              >
                Get in Touch
              </motion.button>
            </Link>
          </FadeUp>
        </div>
      </section>

      <Footer />
    </main>
  );
}
