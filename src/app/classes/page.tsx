"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Users, BookOpen, ArrowRight } from "lucide-react";
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
    schedule: "Sundays, 9:30 AM",
    instructor: "Rabbi JRE",
    audience: "All levels welcome",
    description:
      "Start your week with inspiring Torah study. Topics range from weekly parsha to Jewish philosophy.",
    image: "/images/events/JREevent.jpg",
  },
  {
    id: "womens-class",
    title: "Women's Class",
    schedule: "Sundays, 10:00 AM",
    instructor: "Mrs. JRE",
    audience: "Women",
    description:
      "A warm and engaging class exploring Jewish wisdom through the lens of women's perspectives.",
    image: "/images/classes/WomensClass.png",
  },
  {
    id: "tuesday-chumash",
    title: "Tuesday Evening Chumash",
    schedule: "Tuesdays, 7:30 PM",
    instructor: "Rabbi JRE",
    audience: "Intermediate",
    description:
      "Deep dive into the weekly Torah portion with classical and contemporary commentaries.",
    image: "/images/events/Dinner.jpg",
  },
  {
    id: "thursday-mishmar",
    title: "Thursday Night Mishmar",
    schedule: "Thursdays, 9:00 PM",
    instructor: "Various",
    audience: "Men",
    description:
      "Late-night learning with coffee and camaraderie. A perfect way to end the week.",
    image: "/images/events/ScotchNSteak.jpg",
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
            className="text-xl max-w-2xl mx-auto"
            style={{ color: '#e2e8f0' }}
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
                    className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all flex flex-col md:flex-row"
                  >
                    <div className="relative w-full md:w-2/5 h-48 md:h-auto">
                      <Image
                        src={classItem.image}
                        alt={classItem.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="p-6 flex-grow">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {classItem.title}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {classItem.description}
                      </p>
                      <div className="space-y-2 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#EF8046]" />
                          <span>{classItem.schedule}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[#EF8046]" />
                          <span>{classItem.instructor}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#EF8046]" />
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
