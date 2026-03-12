"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const tabs = [
  { name: "Events", href: "/admin/events" },
  { name: "Donations", href: "/admin/donations" },
  { name: "People", href: "/admin/people" },
  { name: "Gallery", href: "/admin/gallery" },
  { name: "Outreach", href: "/admin/outreach" },
];

export default function AdminTabs() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-6">
        <nav className="flex gap-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const active = isActive(tab.href);

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`relative py-4 text-sm font-medium transition-colors ${
                  active
                    ? "text-[#EF8046]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.name}
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EF8046]"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
