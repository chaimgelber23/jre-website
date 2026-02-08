"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Users, BookOpen, MapPin, Video } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  FadeUp,
  StaggerContainer,
  StaggerItem,
  ScaleOnHover,
} from "@/components/ui/motion";

const classes = [
  {
    id: "sunday-morning",
    title: "Sunday Morning Class",
    subtitle: "Spiritual and Ethical Lessons on Bereishis",
    schedule: "Sundays, 10:55 AM - 11:30 AM",
    instructor: "Rabbi Avi",
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
    instructor: "Elisheva, Shana & Yehudis",
    location: "Zoom",
    audience: "Women",
    description:
      "A warm and engaging women's class exploring the weekly parsha with meaningful insights for daily life.",
    image: "/images/classes/WomensClass.png",
    isZoom: true,
  },
  {
    id: "fire-mysticism",
    title: "Fire & Mysticism",
    subtitle: "Tuesday Evening Chassidut",
    schedule: "Tuesdays, 9:30 PM",
    instructor: "Rabbi Avi",
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
    id: "mitzvot-unpacked",
    title: "Mitzvot Unpacked",
    subtitle: "Tuesday Afternoons",
    schedule: "Tuesdays, 9:30 PM",
    instructor: "Rabbi Yossi",
    location: "Zoom",
    audience: "All levels",
    description:
      "Dive deep into the meaning and practice of the mitzvot with practical applications for modern life.",
    image: "/images/events/Israel.jpg",
    isZoom: true,
  },
  {
    id: "triple-b",
    title: "Triple B Club",
    subtitle: "Interactive Parsha",
    schedule: "Wednesdays, 9:00 PM",
    instructor: "Rabbi Avi",
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
    instructor: "Rabbi Avi",
    location: "Monsey",
    audience: "Men",
    description:
      "Prepare for Shabbat with meaningful Torah learning in a warm and welcoming environment.",
    image: "/images/events/Israel3.jpg",
    isZoom: false,
  },
];

export default function ClassesPage() {
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
            Learn & Grow
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-6xl font-bold mb-6"
            style={{ color: '#ffffff' }}
          >
            Our Classes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl max-w-3xl mx-auto italic"
            style={{ color: '#e2e8f0' }}
          >
            Learning that is relevant and meaningful—it&apos;s wisdom for your life!
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg max-w-2xl mx-auto mt-4"
            style={{ color: '#a0aec0' }}
          >
            With a variety of topics, times, and styles, there&apos;s something for
            everyone.
          </motion.p>
        </div>
      </section>

      {/* Classes Grid */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <StaggerContainer className="grid md:grid-cols-2 gap-8">
            {classes.map((classItem) => (
              <StaggerItem key={classItem.id}>
                <ScaleOnHover scale={1.02}>
                  <motion.div
                    whileHover={{ y: -5 }}
                    className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all flex flex-col md:flex-row h-full"
                  >
                    <div className="relative w-full md:w-2/5 h-48 md:h-auto md:min-h-[250px]">
                      <Image
                        src={classItem.image}
                        alt={classItem.title}
                        fill
                        className="object-cover"
                      />
                      {/* Zoom badge */}
                      {classItem.isZoom && (
                        <div className="absolute top-3 left-3 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                          <Video className="w-3 h-3" />
                          Zoom
                        </div>
                      )}
                    </div>
                    <div className="p-6 flex-grow flex flex-col">
                      <div className="flex-grow">
                        <p className="text-[#EF8046] text-sm font-medium mb-1">
                          {classItem.subtitle}
                        </p>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {classItem.title}
                        </h3>
                        <p className="text-gray-600 mb-4 text-sm">
                          {classItem.description}
                        </p>
                      </div>
                      <div className="space-y-2 text-sm text-gray-500 border-t pt-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#EF8046] flex-shrink-0" />
                          <span>{classItem.schedule}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#EF8046] flex-shrink-0" />
                          <span>{classItem.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[#EF8046] flex-shrink-0" />
                          <span>{classItem.instructor}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#EF8046] flex-shrink-0" />
                          <span>{classItem.audience}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </ScaleOnHover>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Private Learning */}
      <section className="section bg-[#FBFBFB]">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <FadeUp>
              <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-3">
                One-on-One
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Private Learning
              </h2>
              <p className="text-gray-600 text-lg mb-8">
                Looking for a more personalized approach? We offer one-on-one
                learning sessions tailored to your interests, schedule, and
                level. Whether you want to explore Jewish philosophy, learn
                Hebrew, or prepare for a Bar/Bat Mitzvah, we&apos;re here to help.
              </p>
              <Link href="/contact">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-[#EF8046] text-white px-8 py-4 rounded font-medium text-lg shadow-lg hover:bg-[#d96a2f] transition-colors"
                >
                  Schedule a Session
                </motion.button>
              </Link>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section bg-[#EF8046]">
        <div className="container mx-auto px-6 text-center">
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
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white text-[#EF8046] px-8 py-4 rounded font-medium text-lg shadow-lg"
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
