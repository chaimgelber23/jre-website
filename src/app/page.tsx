"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play, Calendar, BookOpen } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  FadeUp,
  FadeIn,
  SlideInLeft,
  SlideInRight,
  StaggerContainer,
  StaggerItem,
  ScaleOnHover,
  TextReveal,
  AnimatedCounter,
} from "@/components/ui/motion";

export default function Home() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <Image
            src="/images/events/JREBensoussan.jpeg"
            alt="JRE Community"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-[#EF8046] font-medium tracking-[0.3em] uppercase mb-4"
            >
              empower. engage. inspire.
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
              style={{ color: '#ffffff' }}
            >
              THE FUTURE OF
              <br />
              <span className="text-[#EF8046] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">ANCIENT WISDOM</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="text-lg md:text-xl max-w-2xl mx-auto mb-10"
              style={{ color: '#e2e8f0' }}
            >
              The JRE enables Jews of all backgrounds to access the deep and
              meaningful wisdom of Judaism in a way that is relevant to their
              daily lives.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/events">
                <button
                  className="bg-[#EF8046] text-white px-8 py-4 rounded font-medium text-lg shadow-lg hover:shadow-xl hover:bg-[#d96a2f] transition-all flex items-center gap-2"
                >
                  Upcoming Events
                  <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
              <Link href="/about">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-transparent border-2 border-white text-white px-8 py-4 rounded font-medium text-lg hover:bg-white hover:text-gray-900 transition-all"
                >
                  Learn More
                </motion.button>
              </Link>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* Welcome Section with Video */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Video */}
            <SlideInLeft>
              <div className="relative aspect-video rounded-lg overflow-hidden shadow-2xl">
                {isVideoPlaying ? (
                  <iframe
                    src="https://www.youtube.com/embed/-pmAhUobfUM?autoplay=1"
                    title="About The JRE"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                ) : (
                  <>
                    <Image
                      src="/images/describejre.jpg"
                      alt="About The JRE"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <button onClick={() => setIsVideoPlaying(true)}>
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-20 h-20 bg-[#EF8046] rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                        >
                          <Play className="w-8 h-8 text-white ml-1" />
                        </motion.div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </SlideInLeft>

            {/* Content */}
            <SlideInRight>
              <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-3">
                Our Story —
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Welcome to the JRE
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">
                Since 2009, the JRE has been providing engaging events,
                sophisticated classes, and all-around meaningful Jewish
                experiences. Believing that Judaism can be alive, vibrant, and
                relevant (and taste great too!) the JRE has created a connected
                community from across Westchester who come to connect, learn,
                and be inspired.
              </p>
              <p className="text-gray-600 text-lg leading-relaxed mb-8">
                Join us at one of our classes or events; you&apos;ll be glad you did!
              </p>
              <Link href="/about">
                <motion.button
                  whileHover={{ x: 5 }}
                  className="text-[#EF8046] font-medium flex items-center gap-2 group"
                >
                  Learn more about us
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Link>
            </SlideInRight>
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="section bg-[#FBFBFB]">
        <div className="container mx-auto px-6">
          <FadeUp className="text-center mb-16">
            <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-3">
              Get Involved
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
              What We Offer
            </h2>
          </FadeUp>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Classes Card */}
            <FadeUp delay={0.1}>
              <Link href="/classes">
                <ScaleOnHover scale={1.02}>
                  <div className="relative h-80 rounded-xl overflow-hidden group cursor-pointer shadow-lg">
                    <Image
                      src="/images/classes/WomensClass.png"
                      alt="Our Classes"
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-[#EF8046] rounded-lg flex items-center justify-center">
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white">
                          Our Classes
                        </h3>
                      </div>
                      <p className="text-gray-200">
                        With a variety of topics, times, and locations,
                        there&apos;s something for everyone.
                      </p>
                    </div>
                  </div>
                </ScaleOnHover>
              </Link>
            </FadeUp>

            {/* Events Card */}
            <FadeUp delay={0.2}>
              <Link href="/events">
                <ScaleOnHover scale={1.02}>
                  <div className="relative h-80 rounded-xl overflow-hidden group cursor-pointer shadow-lg">
                    <Image
                      src="/images/events/ScotchNSteak.jpg"
                      alt="Our Events"
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-[#EF8046] rounded-lg flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-white">
                          Our Events
                        </h3>
                      </div>
                      <p className="text-gray-200">
                        Great people, great food, and meaningful Torah—we&apos;d
                        love to see you!
                      </p>
                    </div>
                  </div>
                </ScaleOnHover>
              </Link>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* Photo Gallery */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <FadeUp className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
              Our Community
            </h2>
          </FadeUp>

          <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              "/images/events/JREBensoussan.jpeg",
              "/images/events/ScotchNSteak.jpg",
              "/images/events/women2.jpg",
              "/images/events/JREevent.jpg",
              "/images/events/Dinner.jpg",
              "/images/classes/WomensClass.png",
            ].map((src, index) => (
              <StaggerItem key={index}>
                <ScaleOnHover scale={1.03}>
                  <div className="relative aspect-square rounded-lg overflow-hidden shadow-md">
                    <Image
                      src={src}
                      alt={`JRE Community ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                </ScaleOnHover>
              </StaggerItem>
            ))}
          </StaggerContainer>
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
              Ready to Join Our Community?
            </h2>
            <p className="text-white/90 text-lg max-w-2xl mx-auto mb-10">
              Experience the warmth, wisdom, and connection that makes the JRE
              special. We&apos;d love to welcome you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/events">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white text-[#EF8046] px-8 py-4 rounded font-medium text-lg shadow-lg hover:shadow-xl transition-all"
                >
                  View Upcoming Events
                </motion.button>
              </Link>
              <Link href="/donate">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-transparent border-2 border-white text-white px-8 py-4 rounded font-medium text-lg hover:bg-white hover:text-[#EF8046] transition-all"
                >
                  Support Our Mission
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
