"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  FadeUp,
  StaggerContainer,
  StaggerItem,
  ScaleOnHover,
} from "@/components/ui/motion";

// Sample events data - this will come from Google Sheets later
const events = [
  {
    id: "chanukah-2025",
    title: "Light It Up - Chanukah Celebration",
    date: "December 16, 2025",
    time: "6:00 PM - 8:00 PM",
    location: "JRE - 1495 Weaver Street, Scarsdale",
    price: 36,
    image: "/images/events/Dinner.jpg",
    description:
      "Join us for an evening of light, latkes, and celebration as we kindle the Chanukah flames together.",
  },
  {
    id: "scotch-steak",
    title: "Scotch & Steak Night",
    date: "January 15, 2026",
    time: "7:30 PM - 10:00 PM",
    location: "JRE - 1495 Weaver Street, Scarsdale",
    price: 75,
    image: "/images/events/ScotchNSteak.jpg",
    description:
      "An evening of fine scotch, premium steak, and thought-provoking Torah discussion for men.",
  },
  {
    id: "purim-2026",
    title: "Purim Celebration",
    date: "March 15, 2026",
    time: "5:00 PM - 8:00 PM",
    location: "JRE - 1495 Weaver Street, Scarsdale",
    price: 25,
    image: "/images/events/JREevent.jpg",
    description:
      "Costumes, music, food, and joy! Celebrate Purim with the whole family.",
  },
];

const pastEvents = [
  {
    title: "High Holiday Services 2024",
    date: "September 2024",
    image: "/images/events/JREBensoussan.jpeg",
  },
  {
    title: "Women's Retreat",
    date: "August 2024",
    image: "/images/events/women2.jpg",
  },
  {
    title: "Summer BBQ",
    date: "July 2024",
    image: "/images/events/Dinner.jpg",
  },
];

export default function EventsPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 bg-gradient-to-b from-[#2d3748] to-[#1a202c]">
        <div className="container mx-auto px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#EF8046] font-medium tracking-wider uppercase mb-4"
          >
            Join Us
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-6xl font-bold mb-6"
            style={{ color: '#ffffff' }}
          >
            Upcoming Events
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl max-w-2xl mx-auto"
            style={{ color: '#e2e8f0' }}
          >
            Great people, great food, and meaningful Torah—we&apos;d love to see you!
          </motion.p>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((event) => (
              <StaggerItem key={event.id}>
                <ScaleOnHover scale={1.02}>
                  <Link href={`/events/${event.id}`}>
                    <motion.div
                      whileHover={{ y: -5 }}
                      className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer h-full flex flex-col"
                    >
                      <div className="relative h-48">
                        <Image
                          src={event.image}
                          alt={event.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="p-6 flex-grow flex flex-col">
                        <h3 className="text-xl font-bold text-gray-900 mb-3">
                          {event.title}
                        </h3>
                        <p className="text-gray-600 mb-4 flex-grow">
                          {event.description}
                        </p>
                        <div className="space-y-2 text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[#EF8046]" />
                            <span>{event.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#EF8046]" />
                            <span>{event.time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#EF8046]" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-100">
                          <span className="text-[#EF8046] font-medium flex items-center gap-2 group">
                            Register Now
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                </ScaleOnHover>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Past Events */}
      <section className="section bg-[#FBFBFB]">
        <div className="container mx-auto px-6">
          <FadeUp className="text-center mb-12">
            <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-3">
              Memories
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
              Past Events
            </h2>
          </FadeUp>

          <StaggerContainer className="grid md:grid-cols-3 gap-6">
            {pastEvents.map((event, index) => (
              <StaggerItem key={index}>
                <div className="relative h-64 rounded-xl overflow-hidden group">
                  <Image
                    src={event.image}
                    alt={event.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <p className="text-[#EF8046] text-sm font-medium mb-1">
                      {event.date}
                    </p>
                    <h3 className="text-xl font-bold text-white">
                      {event.title}
                    </h3>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section bg-[#EF8046]">
        <div className="container mx-auto px-6 text-center">
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
                whileHover={{ scale: 1.05 }}
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
