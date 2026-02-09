"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Users, BookOpen, MapPin, Video, ChevronDown, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { FadeUp } from "@/components/ui/motion";

const classes = [
  {
    id: "sunday-morning",
    title: "Sunday Morning Class",
    subtitle: "Spiritual and Ethical Lessons on Bereishis",
    schedule: "Sundays, 10:55 AM - 11:30 AM",
    instructor: "Rabbi Hoffman",
    location: "The JRE",
    audience: "All levels welcome",
    description:
      "Start your week with inspiring Torah study exploring spiritual and ethical lessons from the book of Bereishis.",
    image: "/images/events/JREevent.jpg",
    isZoom: false,
  },
  {
    id: "tuesday-womens",
    title: "Tuesday Morning Parsha Class",
    subtitle: "Growing and Glowing",
    schedule: "Tuesdays, 10:00 AM",
    instructor: "Elisheva, Shana, Yehudis & Avigail",
    location: "Zoom",
    audience: "Women",
    description:
      "A warm and engaging women's class exploring the weekly parsha with meaningful insights for daily life.",
    image: "/images/classes/WomensClass.png",
    isZoom: false,
  },
  {
    id: "mitzvot-unpacked",
    title: "Mitzvot Unpacked",
    subtitle: "Tuesday Afternoons",
    schedule: "Tuesdays, 9:30 PM",
    instructor: "Rabbi Oratz",
    location: "Zoom",
    audience: "All levels",
    description:
      "Dive deep into the meaning and practice of the mitzvot with practical applications for modern life.",
    image: "/images/events/Israel.jpg",
    isZoom: false,
  },
  {
    id: "fire-mysticism",
    title: "Fire & Mysticism",
    subtitle: "Tuesday Evening Chassidut",
    schedule: "Tuesdays, 9:30 PM",
    instructor: "Rabbi Hoffman",
    location: "Harrison",
    audience: "All levels",
    description:
      "Explore the depths of Chassidic thought and Jewish mysticism in an engaging evening class.",
    image: "/images/events/ScotchNSteak.jpg",
    isZoom: false,
  },
  {
    id: "noble-rashis",
    title: "Sol Noble's Favorite Rashis",
    subtitle: "Tuesday Evening Parsha",
    schedule: "Tuesdays, 9:10 PM - 9:45 PM",
    instructor: "David Noble",
    location: "The JRE",
    audience: "All levels",
    description:
      "Discover the weekly parsha through the lens of Rashi's timeless commentary, curated with care and insight.",
    image: "/images/events/Dinner.jpg",
    isZoom: false,
  },
  {
    id: "triple-b",
    title: "Triple B Club",
    subtitle: "Interactive Parsha",
    schedule: "Wednesdays, 9:00 PM",
    instructor: "Rabbi Hoffman",
    location: "White Plains",
    audience: "All levels",
    description:
      "An interactive and lively parsha discussion that brings Torah to life with engaging conversation.",
    image: "/images/events/JREBensoussan.jpeg",
    isZoom: false,
  },
  {
    id: "thursday-mishmar",
    title: "Thursday Night Mishmar!",
    subtitle: "Classes for Men and Boys",
    schedule: "Thursdays, 8:30 PM - 10:00 PM",
    instructor: "Various Speakers",
    location: "The JRE",
    audience: "Men & Boys",
    description:
      "Late-night learning with cholent, coffee, and camaraderie. A perfect way to end the week with Torah study.",
    image: "/images/classes/ScotchNSteak.jpg",
    isZoom: false,
  },
  {
    id: "friday-morning",
    title: "Friday Morning Torah",
    subtitle: "For Men",
    schedule: "Fridays, 9:45 AM - 10:45 AM",
    instructor: "Rabbi Hoffman",
    location: "Monsey",
    audience: "Men",
    description:
      "Prepare for Shabbat with meaningful Torah learning in a warm and welcoming environment.",
    image: "/images/events/Israel3.jpg",
    isZoom: false,
  },
];

// Decorative shape component
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

// Class Card Component with enhanced animations
function ClassCard({
  classItem,
  index,
}: {
  classItem: typeof classes[0];
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
    >
      <motion.div
        whileHover={{ y: -10, scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col md:flex-row h-full group relative"
      >
        {/* Gradient border effect on hover */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#EF8046] via-[#f59e0b] to-[#EF8046] opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm scale-[1.02]" />

        {/* Image Section */}
        <div className="relative w-full md:w-2/5 h-56 md:h-auto md:min-h-[280px] overflow-hidden">
          <Image
            src={classItem.image}
            alt={classItem.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Zoom badge */}
          {classItem.isZoom && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-4 left-0 bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-r-full flex items-center gap-1.5 shadow-lg"
            >
              <Video className="w-3.5 h-3.5" />
              Zoom
            </motion.div>
          )}

          {/* Shine effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 flex-grow flex flex-col bg-white relative">
          <div className="flex-grow">
            <motion.p
              className="text-[#EF8046] text-sm font-semibold mb-1 uppercase tracking-wide"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: index * 0.1 + 0.2 }}
            >
              {classItem.subtitle}
            </motion.p>
            <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#EF8046] transition-colors duration-300">
              {classItem.title}
            </h3>
            <p className="text-gray-600 mb-4 text-sm leading-relaxed">
              {classItem.description}
            </p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-4">
            <motion.div
              className="flex items-center gap-2 text-gray-600"
              whileHover={{ x: 3 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-8 h-8 rounded-full bg-[#EF8046]/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-[#EF8046]" />
              </div>
              <span className="text-xs">{classItem.schedule}</span>
            </motion.div>
            <motion.div
              className="flex items-center gap-2 text-gray-600"
              whileHover={{ x: 3 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-8 h-8 rounded-full bg-[#EF8046]/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-[#EF8046]" />
              </div>
              <span className="text-xs">{classItem.location}</span>
            </motion.div>
            <motion.div
              className="flex items-center gap-2 text-gray-600"
              whileHover={{ x: 3 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-8 h-8 rounded-full bg-[#EF8046]/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[#EF8046]" />
              </div>
              <span className="text-xs">{classItem.instructor}</span>
            </motion.div>
            <motion.div
              className="flex items-center gap-2 text-gray-600"
              whileHover={{ x: 3 }}
              transition={{ duration: 0.2 }}
            >
              <div className="w-8 h-8 rounded-full bg-[#EF8046]/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#EF8046]" />
              </div>
              <span className="text-xs">{classItem.audience}</span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ClassesPage() {
  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#2d3748] via-[#1a202c] to-[#2d3748]" />

        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <DecorativeShape
            className="absolute -top-20 -right-20 w-96 h-96 bg-[#EF8046]/10 rounded-full blur-3xl"
            delay={0}
          />
          <DecorativeShape
            className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-[#EF8046]/5 rounded-full blur-3xl"
            delay={0.2}
          />
          <DecorativeShape
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#EF8046]/5 rounded-full blur-3xl"
            delay={0.4}
          />
        </div>

        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-[#EF8046]/20 text-[#EF8046] px-4 py-2 rounded-full mb-6"
          >
            <Sparkles className="w-4 h-4" />
            <span className="font-semibold text-sm uppercase tracking-wider">
              Learn & Grow
            </span>
            <Sparkles className="w-4 h-4" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold text-white mb-6"
          >
            Our Classes
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl text-gray-300 max-w-2xl mx-auto"
          >
            Torah learning for everyone, every day of the week
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
                Explore Classes
              </span>
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Classes Grid */}
      <section className="py-20 bg-[#FBFBFB] relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-[#EF8046]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#EF8046]/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-8">
            {classes.map((classItem, index) => (
              <ClassCard key={classItem.id} classItem={classItem} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Private Learning */}
      <section className="py-20 bg-white relative overflow-hidden">
        {/* Decorative line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#EF8046]/30 to-transparent" />

        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <FadeUp>
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring" }}
                className="inline-flex items-center gap-2 bg-[#EF8046]/10 text-[#EF8046] px-4 py-2 rounded-full mb-6"
              >
                <span className="font-semibold text-sm uppercase tracking-wider">
                  One-on-One
                </span>
              </motion.div>

              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Private Learning
              </h2>
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                Looking for a more personalized approach? We offer one-on-one
                learning sessions tailored to your interests, schedule, and
                level. Whether you want to explore Jewish philosophy, learn
                Hebrew, or prepare for a Bar/Bat Mitzvah, we&apos;re here to help.
              </p>
              <Link href="/contact">
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-[#EF8046] text-white px-8 py-4 rounded-xl font-medium text-lg shadow-lg shadow-[#EF8046]/30 hover:bg-[#d96a2f] transition-colors"
                >
                  Schedule a Session
                </motion.button>
              </Link>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#EF8046] relative overflow-hidden">
        {/* Decorative shapes */}
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
              Ready to Start Learning?
            </h2>
            <p className="text-white/90 text-lg max-w-2xl mx-auto mb-10">
              All our classes are free and open to the community. Just show up
              or reach out if you have questions!
            </p>
            <Link href="/contact">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white text-[#EF8046] px-8 py-4 rounded-xl font-medium text-lg shadow-lg"
              >
                Contact Us
              </motion.button>
            </Link>
          </FadeUp>
        </div>
      </section>

      <Footer />
    </main>
  );
}
