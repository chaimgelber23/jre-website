"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Mail, MapPin, Phone } from "lucide-react";
import { FadeUp } from "@/components/ui/motion";

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/classes", label: "Classes" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/donate", label: "Donate" },
];

export default function Footer({ bgColor }: { bgColor?: string }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`${bgColor || "bg-[#2d3748]"} text-white pt-8`}>
      {/* Main Footer */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* About Section */}
          <FadeUp className="lg:col-span-2">
            <Link href="/" className="inline-block mb-6 relative">
              <Image
                src="/images/logo.png"
                alt="The JRE"
                width={140}
                height={47}
                className="brightness-0 invert"
              />
              {/* Torch/flame glow effect */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: '2%',
                  left: '3%',
                  width: '20px',
                  height: '24px',
                  background: 'radial-gradient(ellipse at center, rgba(239, 128, 70, 0.55) 0%, rgba(239, 128, 70, 0.25) 45%, transparent 70%)',
                  filter: 'blur(4px)',
                }}
              />
            </Link>
            <p className="text-gray-300 leading-relaxed mb-6">
              The JRE&apos;s mission is to enable Jews of all backgrounds to access
              the deep and meaningful wisdom of Judaism in a way that is
              relevant to their daily lives.
            </p>
            <p className="text-[#EF8046] font-medium italic">
              &quot;The Future of Ancient Wisdom&quot;
            </p>
          </FadeUp>

          {/* Quick Links */}
          <FadeUp delay={0.1}>
            <h4 className="text-lg font-semibold mb-6">Quick Links</h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-300 hover:text-[#EF8046] transition-colors inline-flex items-center gap-2 group"
                  >
                    <span className="w-0 h-0.5 bg-[#EF8046] group-hover:w-3 transition-all duration-300" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </FadeUp>

          {/* Contact Info */}
          <FadeUp delay={0.2}>
            <h4 className="text-lg font-semibold mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li>
                <a
                  href="mailto:office@thejre.org"
                  className="flex items-start gap-3 text-gray-300 hover:text-[#EF8046] transition-colors"
                >
                  <Mail className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>office@thejre.org</span>
                </a>
              </li>
              <li>
                <a
                  href="tel:914-713-4355"
                  className="flex items-start gap-3 text-gray-300 hover:text-[#EF8046] transition-colors"
                >
                  <Phone className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>914-713-4355</span>
                </a>
              </li>
              <li>
                <a
                  href="https://maps.google.com/?q=1495+Weaver+Street,+Scarsdale,+NY+10583"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-gray-300 hover:text-[#EF8046] transition-colors"
                >
                  <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>
                    1495 Weaver Street
                    <br />
                    Scarsdale, NY 10583
                  </span>
                </a>
              </li>
            </ul>
          </FadeUp>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">
              &copy; {currentYear} The JRE. All rights reserved.
            </p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-400 text-sm"
            >
              Serving the Westchester Jewish Community since 2009
            </motion.p>
          </div>
        </div>
      </div>
    </footer>
  );
}
