"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DollarSign, Calendar, Users } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { name: "Events", href: "/admin/events", icon: Calendar },
  { name: "Donations", href: "/admin", icon: DollarSign },
  { name: "People", href: "/admin/people", icon: Users },
];

export default function AdminTabs() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/donations";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="container mx-auto px-6">
        <nav className="flex gap-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`relative flex items-center gap-2 py-4 text-sm font-medium transition-colors ${
                  active
                    ? "text-[#EF8046]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
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
