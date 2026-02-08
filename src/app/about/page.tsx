"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Heart, Users, Lightbulb, Target } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  FadeUp,
  SlideInLeft,
  SlideInRight,
  StaggerContainer,
  StaggerItem,
  AnimatedCounter,
} from "@/components/ui/motion";

const values = [
  {
    icon: Heart,
    title: "Warmth",
    description:
      "We create a welcoming environment where everyone feels at home, regardless of their background or level of observance.",
  },
  {
    icon: Lightbulb,
    title: "Wisdom",
    description:
      "We make the deep wisdom of Torah accessible and relevant to modern life, empowering people to grow spiritually.",
  },
  {
    icon: Users,
    title: "Community",
    description:
      "We foster meaningful connections, bringing together families from across Westchester to learn, celebrate, and support one another.",
  },
  {
    icon: Target,
    title: "Relevance",
    description:
      "We believe Judaism is alive and vibrant, offering timeless insights that speak to today's challenges and opportunities.",
  },
];

const timeline = [
  {
    year: "2009",
    title: "The Beginning",
    description:
      "The JRE was founded in Scarsdale, NY with a mission to make Jewish wisdom accessible to all.",
  },
  {
    year: "2012",
    title: "Growing Community",
    description:
      "Our classes and events began attracting families from across Westchester County.",
  },
  {
    year: "2015",
    title: "Expanding Programs",
    description:
      "Launched women's classes, family programs, and signature events like Scotch & Steak.",
  },
  {
    year: "2020",
    title: "Adapting & Thriving",
    description:
      "Transitioned to virtual programming during the pandemic, reaching more people than ever.",
  },
  {
    year: "Today",
    title: "Looking Forward",
    description:
      "Continuing to grow, innovate, and serve the Westchester Jewish community with passion.",
  },
];

export default function AboutPage() {
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
            Our Story
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-6xl font-bold mb-6"
            style={{ color: '#ffffff' }}
          >
            About The JRE
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl max-w-2xl mx-auto"
            style={{ color: '#e2e8f0' }}
          >
            The Future of Ancient Wisdom
          </motion.p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <SlideInLeft>
              <div className="relative">
                <div className="relative h-[500px] rounded-xl overflow-hidden shadow-2xl">
                  <Image
                    src="/images/events/JREevent.jpg"
                    alt="JRE Community"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="absolute -bottom-6 -right-6 bg-[#EF8046] text-white p-8 rounded-xl shadow-xl">
                  <p className="text-4xl font-bold">Since</p>
                  <p className="text-5xl font-bold">2009</p>
                </div>
              </div>
            </SlideInLeft>

            <SlideInRight>
              <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-3">
                Our Mission
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Empower. Engage. Inspire.
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                The JRE was founded with a clear mission: To enable Jews of all
                backgrounds to access the deep and meaningful wisdom of Judaism
                in a way that is relevant to their daily lives.
              </p>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                We believe that Judaism is alive, vibrant, and incredibly
                relevant. Our goal is to create experiences—classes, events, and
                community gatherings—that inspire, educate, and connect.
              </p>
              <p className="text-gray-600 text-lg leading-relaxed mb-8">
                Whether you&apos;re exploring your heritage for the first time or
                deepening your existing practice, there&apos;s a place for you at the
                JRE.
              </p>
              <Link href="/contact">
                <motion.button
                  whileHover={{ x: 5 }}
                  className="text-[#EF8046] font-medium flex items-center gap-2"
                >
                  Get in touch
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            </SlideInRight>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="section bg-[#FBFBFB]">
        <div className="container mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-3">
              What We Stand For
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
              Our Values
            </h2>
          </FadeUp>

          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <StaggerItem key={index}>
                <motion.div
                  whileHover={{ y: -5 }}
                  className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition-all h-full"
                >
                  <div className="w-14 h-14 bg-[#EF8046]/10 rounded-lg flex items-center justify-center mb-6">
                    <value.icon className="w-7 h-7 text-[#EF8046]" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {value.title}
                  </h3>
                  <p className="text-gray-600">{value.description}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-3">
              Our Journey
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
              Through the Years
            </h2>
          </FadeUp>

          <div className="max-w-4xl mx-auto">
            {timeline.map((item, index) => (
              <FadeUp key={index} delay={index * 0.1}>
                <div className="flex gap-8 mb-12 last:mb-0">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-[#EF8046] rounded-full flex items-center justify-center text-white font-bold shrink-0">
                      {item.year === "Today" ? "Now" : item.year.slice(-2)}
                    </div>
                    {index < timeline.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 mt-4" />
                    )}
                  </div>
                  <div className="pb-12">
                    <span className="text-[#EF8046] font-medium">
                      {item.year}
                    </span>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1 mb-3">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 text-lg">{item.description}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-[#2d3748] text-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 15, label: "Years of Service", suffix: "+" },
              { value: 500, label: "Families Served", suffix: "+" },
              { value: 100, label: "Events Hosted", suffix: "+" },
              { value: 50, label: "Classes Taught", suffix: "+" },
            ].map((stat, index) => (
              <FadeUp key={index} delay={index * 0.1}>
                <div>
                  <div className="text-4xl md:text-5xl font-bold text-[#EF8046] mb-2">
                    <AnimatedCounter value={stat.value} />
                    {stat.suffix}
                  </div>
                  <p className="text-gray-300">{stat.label}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section bg-[#EF8046]">
        <div className="container mx-auto px-6 text-center">
          <FadeUp>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Join Our Community
            </h2>
            <p className="text-white/90 text-lg max-w-2xl mx-auto mb-10">
              Whether you&apos;re looking for meaningful classes, engaging events, or
              a welcoming community, we&apos;d love to meet you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/events">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white text-[#EF8046] px-8 py-4 rounded font-medium text-lg shadow-lg"
                >
                  View Events
                </motion.button>
              </Link>
              <Link href="/contact">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-transparent border-2 border-white text-white px-8 py-4 rounded font-medium text-lg hover:bg-white hover:text-[#EF8046] transition-all"
                >
                  Contact Us
                </motion.button>
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      <Footer />
    </main>
  );
}
