"use client";

import { motion, useInView, useAnimation, Variants } from "framer-motion";
import { useEffect, useRef, ReactNode } from "react";

// Fade up animation for sections
export function FadeUp({
  children,
  delay = 0,
  duration = 0.5,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Fade in animation
export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Slide in from left
export function SlideInLeft({
  children,
  delay = 0,
  duration = 0.6,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={{
        hidden: { opacity: 0, x: -50 },
        visible: { opacity: 1, x: 0 },
      }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Slide in from right
export function SlideInRight({
  children,
  delay = 0,
  duration = 0.6,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={{
        hidden: { opacity: 0, x: 50 },
        visible: { opacity: 1, x: 0 },
      }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered children animation
export function StaggerContainer({
  children,
  className = "",
  staggerDelay = 0.1,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Individual stagger item
export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

// Scale on hover
export function ScaleOnHover({
  children,
  className = "",
  scale = 1.05,
}: {
  children: ReactNode;
  className?: string;
  scale?: number;
}) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Counter animation for stats
export function AnimatedCounter({
  value,
  duration = 2,
  className = "",
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start({
        opacity: 1,
        transition: { duration: 0.5 },
      });
    }
  }, [isInView, controls]);

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0 }}
      animate={controls}
      className={className}
    >
      {isInView && (
        <motion.span
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration }}
        >
          <CountUp end={value} duration={duration} />
        </motion.span>
      )}
    </motion.span>
  );
}

// Simple count up component
function CountUp({ end, duration }: { end: number; duration: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let startTime: number;
    const startValue = 0;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const currentValue = Math.floor(progress * (end - startValue) + startValue);
      element.textContent = currentValue.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = end.toLocaleString();
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span ref={ref}>0</span>;
}

// Text reveal animation (word by word)
export function TextReveal({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const words = text.split(" ");

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: delay,
      },
    },
  };

  const child: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 12,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.span
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={container}
      className={className}
    >
      {words.map((word, index) => (
        <motion.span key={index} variants={child} className="inline-block mr-1">
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}
