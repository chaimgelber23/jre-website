"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/classes", label: "Classes" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          isScrolled
            ? "bg-[#FBFBFB] shadow-lg py-3"
            : "bg-gradient-to-b from-black/60 to-transparent py-5"
        )}
      >
        <div className="container mx-auto px-6 lg:px-8">
          <nav className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="relative z-10">
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400 }}
                className="relative"
              >
                <Image
                  src="/images/logo.png"
                  alt="The JRE"
                  width={180}
                  height={60}
                  className={cn(
                    "w-auto transition-all duration-500",
                    isScrolled
                      ? "h-12"
                      : "h-16 brightness-0 invert opacity-95"
                  )}
                  style={!isScrolled ? {
                    filter: 'brightness(0) invert(1) drop-shadow(0 0 3px #EF8046) drop-shadow(0 0 6px #EF8046)',
                  } : undefined}
                  priority
                />
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-10">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group relative"
                >
                  <span
                    className={cn(
                      "font-semibold text-[15px] tracking-wide transition-colors duration-300",
                      isScrolled
                        ? "text-[#2d3748] group-hover:text-[#EF8046]"
                        : "text-[#FFF8F0] group-hover:text-[#EF8046]"
                    )}
                  >
                    {link.label}
                  </span>
                  {/* Animated underline */}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#EF8046] transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}

              {/* Donate Button */}
              <Link href="/donate">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "px-7 py-3 rounded-md font-semibold text-[15px] tracking-wide transition-all duration-300",
                    isScrolled
                      ? "bg-[#EF8046] text-white shadow-md hover:shadow-lg hover:bg-[#d96a2f]"
                      : "bg-[#EF8046] text-white shadow-lg hover:shadow-xl hover:bg-[#d96a2f]"
                  )}
                >
                  Donate Now
                </motion.button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden relative z-10 p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className={cn("w-7 h-7 transition-colors", isScrolled ? "text-[#2d3748]" : "text-[#FFF8F0]")} />
              ) : (
                <Menu className={cn("w-7 h-7 transition-colors", isScrolled ? "text-[#2d3748]" : "text-[#FFF8F0]")} />
              )}
            </button>
          </nav>
        </div>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.nav
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-[85%] max-w-md bg-white shadow-2xl"
            >
              <div className="flex flex-col h-full">
                {/* Mobile Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                  <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                    <Image
                      src="/images/logo.png"
                      alt="The JRE"
                      width={120}
                      height={40}
                      className="h-10 w-auto"
                    />
                  </Link>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                </div>

                {/* Mobile Links */}
                <div className="flex-1 py-6 px-6 overflow-y-auto">
                  {navLinks.map((link, index) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center py-4 text-lg font-medium text-gray-800 hover:text-[#EF8046] transition-colors border-b border-gray-50"
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* Mobile Donate Button */}
                <div className="p-6 border-t border-gray-100">
                  <Link
                    href="/donate"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <button className="w-full bg-[#EF8046] text-white py-4 rounded-lg font-semibold text-lg hover:bg-[#d96a2f] transition-colors shadow-md">
                      Donate Now
                    </button>
                  </Link>
                </div>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
