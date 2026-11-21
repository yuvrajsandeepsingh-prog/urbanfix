import React, { useRef, useState } from 'react';
import {
  MotionValue,
  motion,
  transform,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform
} from 'motion/react';
import {
  ArrowDown,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  Wrench
} from 'lucide-react';
import { Complaint, StatusHistoryEntry } from '../types/urbanfix';
import { lookupComplaintByReference } from '../lib/dataService';

import heroCityImg from '../assets/images/hero_city_skyline_street_1793130642091.jpg';
import problemPotholeImg from '../assets/images/scene_pothole_street_problem_1793130643918.jpg';
import reportPhoneImg from '../assets/images/scene_citizen_smartphone_report_1793130645178.jpg';
import actionRepairImg from '../assets/images/scene_municipal_road_repair_1793130645606.jpg';
import resolutionRoadImg from '../assets/images/urban_civic_infrastructure_hero_1793128634868.jpg';

interface LandingViewProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onInspectComplaint: (complaint: Complaint, history: StatusHistoryEntry[]) => void;
}

type FallbackVariant = 'city' | 'problem' | 'report' | 'action' | 'resolution';

/**
 * Synchronizes scroll-driven transforms through Motion's clamped JS interpolation loop.
 * Avoids partial-offset WAAPI ViewTimeline keyframe synthesis issues on >100vh sticky scenes
 * so opacity, clip-path, scale, and parallax stay locked together in both dev and production builds.
 */
function useClampedScrollTransform<T>(
  source: MotionValue<number>,
  inputRange: number[],
  outputRange: T[]
): MotionValue<T> {
  const mapper = transform(inputRange, outputRange, { clamp: true });
  return useTransform(source, (latest) => mapper(latest));
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

const ArchitecturalFallback: React.FC<{ variant: FallbackVariant }> = ({ variant }) => {
  return (
    <div className="w-full h-full bg-[#091324] relative overflow-hidden flex items-center justify-center">
      <svg
        viewBox="0 0 1200 720"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover opacity-80"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`sky-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#081120" />
            <stop offset="60%" stopColor="#10213A" />
            <stop offset="100%" stopColor="#16324F" />
          </linearGradient>
          <linearGradient id={`road-${variant}`} x1="600" y1="400" x2="600" y2="720">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
        </defs>
        <rect width="1200" height="720" fill={`url(#sky-${variant})`} />
        {/* Architectural skyline */}
        <rect x="70" y="180" width="140" height="300" fill="#0B172A" stroke="#1E3A5F" strokeWidth="1" />
        <rect x="230" y="230" width="120" height="250" fill="#0D1C33" stroke="#1E3A5F" strokeWidth="1" />
        <rect x="830" y="160" width="160" height="320" fill="#0B172A" stroke="#1E3A5F" strokeWidth="1" />
        <rect x="1010" y="210" width="130" height="270" fill="#0D1C33" stroke="#1E3A5F" strokeWidth="1" />
        {/* Perspective street */}
        <polygon points="460,440 740,440 1120,720 80,720" fill={`url(#road-${variant})`} />
        <line x1="600" y1="450" x2="600" y2="720" stroke="#0D9488" strokeWidth="2" strokeDasharray="18 18" opacity="0.6" />
        {(variant === 'problem' || variant === 'report') && (
          <ellipse cx="585" cy="610" rx="85" ry="26" fill="#081120" stroke="#F59E0B" strokeWidth="1.5" opacity="0.85" />
        )}
        {variant === 'resolution' && (
          <polygon points="475,450 725,450 1040,720 160,720" fill="#0D9488" opacity="0.14" />
        )}
      </svg>
    </div>
  );
};

const ScenePhoto: React.FC<{
  src: string;
  alt: string;
  variant: FallbackVariant;
  className?: string;
  loading?: 'eager' | 'lazy';
}> = ({ src, alt, variant, className = '', loading = 'lazy' }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ArchitecturalFallback variant={variant} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover ${className}`}
    />
  );
};

export const LandingView: React.FC<LandingViewProps> = ({
  onGetStarted,
  onSignIn,
  onInspectComplaint
}) => {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const storyStartRef = useRef<HTMLDivElement>(null);

  // Page-wide scroll progress bar
  const { scrollYProgress: pageProgress } = useScroll();
  const smoothPageProgress = useSpring(pageProgress, {
    stiffness: 130,
    damping: 28,
    restDelta: 0.001
  });

  // Hero scroll choreography
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  });
  const heroImgScale = useClampedScrollTransform(
    heroScroll,
    [0, 1],
    prefersReducedMotion ? [1, 1] : [1, 1.1]
  );
  const heroImgY = useClampedScrollTransform(
    heroScroll,
    [0, 1],
    prefersReducedMotion ? ['0%', '0%'] : ['0%', '12%']
  );
  const heroContentOpacity = useClampedScrollTransform(
    heroScroll,
    [0, 0.78, 1],
    prefersReducedMotion ? [1, 1, 1] : [1, 0, 0]
  );
  const heroContentY = useClampedScrollTransform(
    heroScroll,
    [0, 0.78, 1],
    prefersReducedMotion ? [0, 0, 0] : [0, -36, -36]
  );

  // Scene 1: The City
  const scene1Ref = useRef<HTMLElement>(null);
  const { scrollYProgress: s1 } = useScroll({
    target: scene1Ref,
    offset: ['start start', 'end end']
  });
  const s1Scale = useClampedScrollTransform(
    s1,
    [0, 0.5, 1],
    prefersReducedMotion ? [1, 1, 1] : [1.14, 1.04, 1.0]
  );
  const s1ParallaxY = useClampedScrollTransform(
    s1,
    [0, 1],
    prefersReducedMotion ? ['0%', '0%'] : ['4%', '-5%']
  );
  const s1Clip = useClampedScrollTransform(
    s1,
    [0, 0.35, 1],
    prefersReducedMotion
      ? ['inset(0% 0% 0% 0% round 0px)', 'inset(0% 0% 0% 0% round 0px)', 'inset(0% 0% 0% 0% round 0px)']
      : ['inset(6% 4% 6% 4% round 20px)', 'inset(0% 0% 0% 0% round 0px)', 'inset(0% 0% 0% 0% round 0px)']
  );
  const s1HeadlineY = useClampedScrollTransform(
    s1,
    [0, 0.32, 1],
    prefersReducedMotion ? [0, 0, 0] : [22, 0, -10]
  );
  const s1StageOpacity = useClampedScrollTransform(
    s1,
    [0, 0.85, 1],
    prefersReducedMotion ? [1, 1, 1] : [1, 1, 0.25]
  );
  const s1DetailY = useClampedScrollTransform(
    s1,
    [0, 0.42, 1],
    prefersReducedMotion ? [0, 0, 0] : [26, 0, -8]
  );

  // Scene 2: The Problem
  const scene2Ref = useRef<HTMLElement>(null);
  const { scrollYProgress: s2 } = useScroll({
    target: scene2Ref,
    offset: ['start start', 'end end']
  });
  const s2ImgScale = useClampedScrollTransform(
    s2,
    [0, 0.6, 1],
    prefersReducedMotion ? [1, 1, 1] : [1.22, 1.05, 1.0]
  );
  const s2ImgY = useClampedScrollTransform(
    s2,
    [0, 0.65, 1],
    prefersReducedMotion ? ['0%', '0%', '0%'] : ['-6%', '3%', '3%']
  );
  const s2StageOpacity = useClampedScrollTransform(
    s2,
    [0, 0.86, 1],
    prefersReducedMotion ? [1, 1, 1] : [1, 1, 0.22]
  );
  const s2TextY = useClampedScrollTransform(
    s2,
    [0, 0.34, 1],
    prefersReducedMotion ? [0, 0, 0] : [24, 0, -8]
  );
  const s2FocusFrameScale = useClampedScrollTransform(
    s2,
    [0, 0.48, 1],
    prefersReducedMotion ? [1, 1, 1] : [1.08, 1, 1]
  );

  // Scene 3: Report (Smartphone photo -> Polished Complaint Card)
  const scene3Ref = useRef<HTMLElement>(null);
  const { scrollYProgress: s3 } = useScroll({
    target: scene3Ref,
    offset: ['start start', 'end end']
  });
  const s3BgScale = useClampedScrollTransform(
    s3,
    [0, 0.5, 1],
    prefersReducedMotion ? [1, 1, 1] : [1.08, 1.02, 0.98]
  );
  const s3BgDim = useClampedScrollTransform(
    s3,
    [0, 0.15, 0.55, 1],
    prefersReducedMotion ? [0.65, 0.65, 0.65, 0.65] : [0.38, 0.42, 0.72, 0.74]
  );
  const s3CardY = useClampedScrollTransform(
    s3,
    [0, 0.42, 1],
    prefersReducedMotion ? [0, 0, 0] : [44, 0, -6]
  );
  const s3CardScale = useClampedScrollTransform(
    s3,
    [0, 0.42, 1],
    prefersReducedMotion ? [1, 1, 1] : [0.93, 1, 1]
  );

  // Scene 4: Action (Municipal dispatch & Submitted -> In Progress)
  const scene4Ref = useRef<HTMLElement>(null);
  const { scrollYProgress: s4 } = useScroll({
    target: scene4Ref,
    offset: ['start start', 'end end']
  });
  const s4ImgScale = useClampedScrollTransform(
    s4,
    [0, 0.6, 1],
    prefersReducedMotion ? [1, 1, 1] : [1.14, 1.04, 1.0]
  );
  const s4ImgX = useClampedScrollTransform(
    s4,
    [0, 1],
    prefersReducedMotion ? ['0%', '0%'] : ['-2%', '2%']
  );
  const s4PanelY = useClampedScrollTransform(
    s4,
    [0, 0.34, 1],
    prefersReducedMotion ? [0, 0, 0] : [32, 0, -6]
  );
  const s4ProgressWidth = useClampedScrollTransform(
    s4,
    [0, 0.14, 0.78, 1],
    prefersReducedMotion ? ['78%', '78%', '78%', '78%'] : ['16%', '22%', '84%', '88%']
  );
  const s4SubmittedOpacity = useClampedScrollTransform(
    s4,
    [0, 0.24, 0.46, 1],
    prefersReducedMotion ? [0, 0, 0, 0] : [1, 1, 0, 0]
  );
  const s4InProgressOpacity = useClampedScrollTransform(
    s4,
    [0, 0.38, 0.58, 1],
    prefersReducedMotion ? [1, 1, 1, 1] : [0, 0, 1, 1]
  );

  // Scene 5: Resolution (Repaired boulevard + Resolved Complaint Card)
  const scene5Ref = useRef<HTMLElement>(null);
  const { scrollYProgress: s5 } = useScroll({
    target: scene5Ref,
    offset: ['start start', 'end end']
  });
  const s5Clip = useClampedScrollTransform(
    s5,
    [0, 0.38, 1],
    prefersReducedMotion
      ? ['inset(0% 0% 0% 0% round 0px)', 'inset(0% 0% 0% 0% round 0px)', 'inset(0% 0% 0% 0% round 0px)']
      : ['inset(10% 5% 10% 5% round 20px)', 'inset(0% 0% 0% 0% round 0px)', 'inset(0% 0% 0% 0% round 0px)']
  );
  const s5ImgScale = useClampedScrollTransform(
    s5,
    [0, 0.7, 1],
    prefersReducedMotion ? [1, 1, 1] : [1.12, 1.0, 1.0]
  );
  const s5CardY = useClampedScrollTransform(
    s5,
    [0, 0.44, 1],
    prefersReducedMotion ? [0, 0, 0] : [36, 0, -4]
  );
  const s5ResolvedBadgeScale = useClampedScrollTransform(
    s5,
    [0, 0.2, 0.56, 1],
    prefersReducedMotion ? [1, 1, 1, 1] : [0.9, 0.92, 1, 1]
  );

  // Optional quiet reference lookup in Final section (preserves public tracking capability cleanly)
  const [lookupOpen, setLookupOpen] = useState(false);
  const [trackingRef, setTrackingRef] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const handleTrackLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = trackingRef.trim().toUpperCase();
    if (!normalized) {
      setTrackingError('Enter a complaint reference ID such as UF-2026-1042.');
      return;
    }
    setTrackingLoading(true);
    setTrackingError(null);
    try {
      const found = await lookupComplaintByReference(normalized);
      if (!found) {
        setTrackingError(`No complaint found with reference "${normalized}".`);
      } else {
        onInspectComplaint(found.complaint, found.history);
      }
    } catch {
      setTrackingError('Unable to retrieve status right now. Please try again.');
    } finally {
      setTrackingLoading(false);
    }
  };

  return (
    <div className="bg-[#07101E] text-[#F8FAFC] selection:bg-teal-500/30 selection:text-white">
      {/* Subtle Top Scroll Progress Indicator */}
      <motion.div
        style={{ scaleX: smoothPageProgress }}
        className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-teal-400 origin-left pointer-events-none"
        aria-hidden="true"
      />

      {/* =====================================================================
          OPENING — CINEMATIC FULL-SCREEN HERO
      ===================================================================== */}
      <section
        ref={heroRef}
        className="relative min-h-[100svh] w-full overflow-hidden flex flex-col justify-between pt-24 pb-10 px-6 sm:px-10 lg:px-16"
      >
        {/* Layered Urban City Scene */}
        <motion.div
          style={{ scale: heroImgScale, y: heroImgY }}
          className="absolute inset-0 z-0 will-change-transform"
        >
          <ScenePhoto
            src={heroCityImg}
            alt="Wide architectural morning view of an Indian city avenue with buildings, trees, and commuters"
            variant="city"
            loading="eager"
          />
          {/* Measured layered editorial scrims for high-contrast legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#07101E]/80 via-[#07101E]/45 to-[#07101E]/92" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07101E]/80 via-[#07101E]/25 to-transparent" />
        </motion.div>

        <div className="relative z-10 flex-1 flex items-center max-w-6xl w-full mx-auto">
          <motion.div
            style={{ opacity: heroContentOpacity, y: heroContentY }}
            className="max-w-3xl space-y-7"
          >
            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE_OUT_EXPO }}
              className="text-xs sm:text-sm font-medium tracking-wide text-teal-300"
            >
              Civic Infrastructure Reporting & Resolution
            </motion.p>

            <div className="overflow-hidden">
              <motion.h1
                initial={prefersReducedMotion ? false : { opacity: 0, y: 34 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.08, ease: EASE_OUT_EXPO }}
                className="font-display font-bold text-white tracking-tight balance-text leading-[1.05]"
                style={{ fontSize: 'clamp(2.75rem, 6vw, 5.25rem)' }}
              >
                Small Actions. Better Cities.
              </motion.h1>
            </div>

            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.18, ease: EASE_OUT_EXPO }}
              className="text-base sm:text-xl text-slate-200 leading-relaxed max-w-xl font-normal"
            >
              Report urban problems. Track progress. Help build a better city.
            </motion.p>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.28, ease: EASE_OUT_EXPO }}
              className="pt-2 flex flex-wrap items-center gap-4"
            >
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() =>
                  storyStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-slate-200 hover:text-white border border-white/20 hover:border-white/40 bg-white/5 backdrop-blur-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Follow a Street Story</span>
              </button>
            </motion.div>
          </motion.div>
        </div>

        {/* Minimal Scroll Indicator */}
        <motion.div
          style={{ opacity: heroContentOpacity }}
          className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between text-xs text-slate-300/80 pt-6 border-t border-white/10"
        >
          <span>Scroll to experience how one citizen report transforms a street</span>
          <button
            type="button"
            onClick={() =>
              storyStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            className="inline-flex items-center gap-2 text-slate-200 hover:text-teal-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            aria-label="Scroll down to Scene 1"
          >
            <span>Scroll</span>
            <motion.span
              animate={prefersReducedMotion ? undefined : { y: [0, 4, 0] }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
              }
              className="inline-flex"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </motion.span>
          </button>
        </motion.div>
      </section>

      {/* =====================================================================
          SCENE 1 — THE CITY
      ===================================================================== */}
      <section
        ref={scene1Ref}
        className={`relative ${prefersReducedMotion ? 'min-h-screen py-20' : 'h-[185vh]'}`}
      >
        <div
          ref={storyStartRef}
          className={`${
            prefersReducedMotion ? 'min-h-[80vh]' : 'sticky top-0 h-screen'
          } w-full overflow-hidden flex items-end pb-16 sm:pb-24 px-6 sm:px-10 lg:px-16`}
        >
          <motion.div
            style={{ clipPath: s1Clip }}
            className="absolute inset-0 z-0 overflow-hidden will-change-transform"
          >
            <motion.div
              style={{ scale: s1Scale, y: s1ParallaxY }}
              className="w-full h-full will-change-transform"
            >
              <ScenePhoto
                src={heroCityImg}
                alt="Bustling urban avenue with buildings, pedestrians, buses, and tree-lined sidewalks"
                variant="city"
              />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#07101E] via-[#07101E]/45 to-[#07101E]/25" />
          </motion.div>

          <motion.div
            style={{ opacity: s1StageOpacity }}
            className="relative z-10 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-end"
          >
            <motion.div
              style={{ y: s1HeadlineY }}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
              className="lg:col-span-8 space-y-4"
            >
              <div className="flex items-center gap-3 text-xs font-mono text-teal-300 tabular-nums">
                <span>01 / 05</span>
                <span aria-hidden="true">·</span>
                <span>The Living Street</span>
              </div>
              <h2
                className="font-display font-bold text-white tracking-tight balance-text leading-[1.1]"
                style={{ fontSize: 'clamp(2rem, 4.2vw, 3.6rem)' }}
              >
                Every city has problems that deserve attention.
              </h2>
            </motion.div>

            <motion.div
              style={{ y: s1DetailY }}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.7, delay: 0.12, ease: EASE_OUT_EXPO }}
              className="lg:col-span-4 space-y-3 text-sm sm:text-base text-slate-200/90 leading-relaxed border-t border-white/15 pt-4"
            >
              <p>
                Thousands of commuters, cyclists, and pedestrians share the same corridors every
                morning—passing cracked footpaths, dark street poles, and worn intersections that
                quietly compound when left unreported.
              </p>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>Roads</span>
                <span aria-hidden="true">·</span>
                <span>Water</span>
                <span aria-hidden="true">·</span>
                <span>Waste</span>
                <span aria-hidden="true">·</span>
                <span>Lighting</span>
                <span aria-hidden="true">·</span>
                <span>Drainage</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================================
          SCENE 2 — THE PROBLEM
      ===================================================================== */}
      <section
        ref={scene2Ref}
        className={`relative ${prefersReducedMotion ? 'min-h-screen py-20' : 'h-[200vh]'}`}
      >
        <div
          className={`${
            prefersReducedMotion ? 'min-h-[80vh]' : 'sticky top-0 h-screen'
          } w-full overflow-hidden flex flex-col justify-between py-16 sm:py-24 px-6 sm:px-10 lg:px-16`}
        >
          <motion.div
            style={{ scale: s2ImgScale, y: s2ImgY }}
            className="absolute inset-0 z-0 will-change-transform"
          >
            <ScenePhoto
              src={problemPotholeImg}
              alt="A citizen pausing on the sidewalk noticing a water-filled asphalt pothole on the street"
              variant="problem"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07101E]/95 via-[#07101E]/40 to-[#07101E]/65" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07101E]/80 via-transparent to-transparent" />
          </motion.div>

          {/* Subtle Camera Focus Frame Highlighting the Hazard */}
          <motion.div
            style={{ opacity: s2StageOpacity }}
            className="relative z-10 max-w-6xl w-full mx-auto pt-6"
          >
            <motion.div
              style={{ y: s2TextY }}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
              className="max-w-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-xs font-mono text-teal-300 tabular-nums">
                <span>02 / 05</span>
                <span aria-hidden="true">·</span>
                <span>The Observation</span>
              </div>
              <h2
                className="font-display font-bold text-white tracking-tight balance-text leading-[1.1]"
                style={{ fontSize: 'clamp(2rem, 4.2vw, 3.6rem)' }}
              >
                It starts with one problem on one street.
              </h2>
              <p className="text-sm sm:text-base text-slate-200/90 max-w-xl leading-relaxed">
                Near Metro Pillar 142 on Indiranagar 100ft Road, a fractured, waterlogged pothole
                forces two-wheelers to swerve into oncoming traffic. Someone stops and takes notice.
              </p>
            </motion.div>
          </motion.div>

          {/* Architectural Inspection Framing Overlay */}
          <motion.div
            style={{ opacity: s2StageOpacity, scale: s2FocusFrameScale }}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.7, delay: 0.14, ease: EASE_OUT_EXPO }}
            className="relative z-10 max-w-6xl w-full mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4"
          >
            <div className="inline-flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0B1628]/80 backdrop-blur-md border border-white/15 text-xs text-slate-200">
              <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Indiranagar 100ft Road, Ward 78</span>
              <span aria-hidden="true" className="text-slate-500">
                ·
              </span>
              <span className="text-amber-300 font-medium">Surface Hazard Observed</span>
            </div>

            <div
              className="hidden sm:block w-44 h-24 border border-teal-400/40 rounded-lg relative pointer-events-none"
              aria-hidden="true"
            >
              <span className="absolute -top-2.5 left-3 px-1.5 bg-[#07101E] text-[10px] font-mono text-teal-300">
                WARD 78 · LANE 02
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =====================================================================
          SCENE 3 — REPORT (Photo Morphs into Complaint Report Card)
      ===================================================================== */}
      <section
        ref={scene3Ref}
        className={`relative ${prefersReducedMotion ? 'min-h-screen py-20' : 'h-[225vh]'}`}
      >
        <div
          className={`${
            prefersReducedMotion ? 'min-h-[85vh]' : 'sticky top-0 h-screen'
          } w-full overflow-hidden flex items-center py-16 px-6 sm:px-10 lg:px-16`}
        >
          {/* Background: Citizen taking photo on smartphone */}
          <motion.div
            style={{ scale: s3BgScale }}
            className="absolute inset-0 z-0 will-change-transform"
          >
            <ScenePhoto
              src={reportPhoneImg}
              alt="Citizen holding a smartphone to photograph a street pothole in morning daylight"
              variant="report"
            />
            <motion.div
              style={{ opacity: s3BgDim }}
              className="absolute inset-0 bg-[#07101E]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07101E]/90 via-[#07101E]/55 to-[#07101E]/75" />
          </motion.div>

          <div className="relative z-10 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Narrative Copy */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
              className="lg:col-span-6 space-y-5"
            >
              <div className="flex items-center gap-3 text-xs font-mono text-teal-300 tabular-nums">
                <span>03 / 05</span>
                <span aria-hidden="true">·</span>
                <span>Citizen Report</span>
              </div>
              <h2
                className="font-display font-bold text-white tracking-tight balance-text leading-[1.1]"
                style={{ fontSize: 'clamp(2rem, 4.2vw, 3.6rem)' }}
              >
                One report can start a change.
              </h2>
              <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-lg">
                A quick smartphone photo, a ward locality, and a nearby landmark assemble into a
                verifiable civic record—assigning a permanent reference code citizens can track from
                day one.
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-300 pt-1">
                <Camera className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Photo captured on street · Reference generated automatically</span>
              </div>
            </motion.div>

            {/* Animated Complaint-Report Card Assembled from Smartphone Capture */}
            <div className="lg:col-span-6 flex justify-start lg:justify-end">
              <motion.div
                style={{
                  y: s3CardY,
                  scale: s3CardScale
                }}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.75, delay: 0.1, ease: EASE_OUT_EXPO }}
                className="w-full max-w-md bg-[#F8FAFC] text-[#0F172A] rounded-xl border border-slate-200 overflow-hidden shadow-2xl will-change-transform"
              >
                {/* Captured Photo Header */}
                <div className="relative h-44 sm:h-48 bg-slate-900 overflow-hidden">
                  <ScenePhoto
                    src={problemPotholeImg}
                    alt="Attached pothole field evidence"
                    variant="problem"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white">
                    <span className="font-medium">Field Evidence Attached</span>
                    <span className="font-mono tabular-nums text-teal-300">08:42 AM</span>
                  </div>
                </div>

                {/* Assembled Report Metadata */}
                <div className="p-5 sm:p-6 space-y-4">
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.6, delay: 0.18, ease: EASE_OUT_EXPO }}
                    className="space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        UF-2026-1042
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Roads & Footpaths</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      Deep waterlogged pothole obstructing two-wheeler lane
                    </h3>

                    <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <span>Indiranagar 100ft Road, Ward 78 · Metro Pillar 142</span>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.6, delay: 0.28, ease: EASE_OUT_EXPO }}
                    className="pt-3.5 border-t border-slate-200 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-500">Current Status</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>Submitted</span>
                    </span>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SCENE 4 — ACTION (Municipal Crew + Submitted -> In Progress)
      ===================================================================== */}
      <section
        ref={scene4Ref}
        className={`relative ${prefersReducedMotion ? 'min-h-screen py-20' : 'h-[225vh]'}`}
      >
        <div
          className={`${
            prefersReducedMotion ? 'min-h-[85vh]' : 'sticky top-0 h-screen'
          } w-full overflow-hidden flex items-end pb-16 sm:pb-20 px-6 sm:px-10 lg:px-16`}
        >
          <motion.div
            style={{ scale: s4ImgScale, x: s4ImgX }}
            className="absolute inset-0 z-0 will-change-transform"
          >
            <ScenePhoto
              src={actionRepairImg}
              alt="Municipal engineering crew inspecting and resurfacing the asphalt street with a road roller"
              variant="action"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07101E] via-[#07101E]/55 to-[#07101E]/35" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07101E]/85 via-[#07101E]/35 to-transparent" />
          </motion.div>

          <div className="relative z-10 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
              className="lg:col-span-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-xs font-mono text-teal-300 tabular-nums">
                <span>04 / 05</span>
                <span aria-hidden="true">·</span>
                <span>Municipal Dispatch</span>
              </div>
              <h2
                className="font-display font-bold text-white tracking-tight balance-text leading-[1.1]"
                style={{ fontSize: 'clamp(2rem, 4.2vw, 3.6rem)' }}
              >
                The right issue reaches the right people.
              </h2>
              <p className="text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-lg">
                Nodal officers review incoming ward reports, assign the responsible engineering
                wing, and log every dispatch milestone on a transparent status timeline.
              </p>
            </motion.div>

            {/* Live Status Transition & Progress Card */}
            <motion.div
              style={{ y: s4PanelY }}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT_EXPO }}
              className="lg:col-span-6 bg-[#0B1628]/90 backdrop-blur-md border border-white/15 rounded-xl p-5 sm:p-6 space-y-5 will-change-transform"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
                <div className="space-y-0.5">
                  <div className="font-mono text-xs text-teal-300 tabular-nums">UF-2026-1042</div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Public Works & Roads Dept</span>
                  </div>
                </div>

                {/* Scrubbed Status Crossfade: Submitted -> In Progress */}
                <div className="relative h-6 min-w-[125px] flex items-center justify-end text-xs font-semibold">
                  <motion.span
                    style={{ opacity: s4SubmittedOpacity }}
                    className="absolute right-0 inline-flex items-center gap-1.5 text-amber-300"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Submitted</span>
                  </motion.span>
                  <motion.span
                    style={{ opacity: s4InProgressOpacity }}
                    className="inline-flex items-center gap-1.5 text-teal-300"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>In Progress</span>
                  </motion.span>
                </div>
              </div>

              {/* Scroll-linked Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Field Crew Inspection & Hot-Mix Resurfacing</span>
                  <span className="font-mono tabular-nums text-teal-300">Ward 78 Squad</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    style={{ width: s4ProgressWidth }}
                    className="h-full bg-teal-400 rounded-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>01. Logged</span>
                  <span>02. Wing Assigned</span>
                  <span className="text-teal-300 font-medium">03. On-Site Repair</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SCENE 5 — RESOLUTION (Repaired Road + Resolved Card)
      ===================================================================== */}
      <section
        ref={scene5Ref}
        className={`relative ${prefersReducedMotion ? 'min-h-screen py-20' : 'h-[215vh]'}`}
      >
        <div
          className={`${
            prefersReducedMotion ? 'min-h-[85vh]' : 'sticky top-0 h-screen'
          } w-full overflow-hidden flex items-center py-16 px-6 sm:px-10 lg:px-16`}
        >
          <motion.div
            style={{ clipPath: s5Clip }}
            className="absolute inset-0 z-0 overflow-hidden will-change-transform"
          >
            <motion.div
              style={{ scale: s5ImgScale }}
              className="w-full h-full will-change-transform"
            >
              <ScenePhoto
                src={resolutionRoadImg}
                alt="Clean, freshly paved urban boulevard in morning sunlight with smooth traffic flow and safe sidewalks"
                variant="resolution"
              />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#07101E]/90 via-[#07101E]/35 to-[#07101E]/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07101E]/85 via-[#07101E]/35 to-transparent" />
          </motion.div>

          <div className="relative z-10 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
              className="lg:col-span-6 space-y-5"
            >
              <div className="flex items-center gap-3 text-xs font-mono text-teal-300 tabular-nums">
                <span>05 / 05</span>
                <span aria-hidden="true">·</span>
                <span>Verified Outcome</span>
              </div>
              <h2
                className="font-display font-bold text-white tracking-tight balance-text leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4.6vw, 4rem)' }}
              >
                Progress you can see.
              </h2>
              <p className="text-base sm:text-xl text-slate-100 leading-relaxed max-w-lg">
                Better reporting. Clearer tracking. Stronger communities.
              </p>
            </motion.div>

            {/* Resolved Complaint Verification Card */}
            <div className="lg:col-span-6 flex justify-start lg:justify-end">
              <motion.div
                style={{ y: s5CardY }}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.75, delay: 0.1, ease: EASE_OUT_EXPO }}
                className="w-full max-w-md bg-white text-[#0F172A] rounded-xl border border-slate-200 p-6 space-y-5 shadow-2xl will-change-transform"
              >
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200">
                  <div className="space-y-0.5">
                    <div className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
                      UF-2026-1042
                    </div>
                    <div className="text-xs text-slate-500">Indiranagar 100ft Road, Ward 78</div>
                  </div>

                  <motion.div
                    style={{ scale: s5ResolvedBadgeScale }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Resolved</span>
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Asphalt surface leveled, compacted, and reopened
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Completed by Public Works & Roads Dept. Full chronological history preserved for
                    the reporting citizen.
                  </p>
                </div>

                {/* Compact Audit Trail */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                  <span>Submitted → In Progress → Resolved</span>
                  <span className="text-emerald-700 font-semibold">Verified</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SCENE 6 — FINAL CALL TO ACTION & MINIMAL FOOTER
      ===================================================================== */}
      <section className="bg-[#F8FAFC] text-[#0F172A] pt-24 pb-12 px-6 sm:px-10 lg:px-16 border-t border-slate-200">
        <div className="max-w-5xl mx-auto space-y-20">
          {/* High-Impact Closing Call to Action */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.75, ease: EASE_OUT_EXPO }}
            className="bg-[#0B1528] text-white rounded-2xl p-8 sm:p-14 lg:p-16 flex flex-col lg:flex-row lg:items-center justify-between gap-10 border border-slate-800"
          >
            <div className="space-y-4 max-w-xl">
              <p className="text-xs font-medium text-teal-300">
                Make a visible difference on your street
              </p>
              <h2
                className="font-display font-bold tracking-tight balance-text leading-[1.1]"
                style={{ fontSize: 'clamp(2rem, 3.8vw, 3.1rem)' }}
              >
                Ready to report an issue in your neighborhood?
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Create a citizen account in moments to document road hazards, water leaks, waste
                overflow, streetlight outages, or drainage blockages—and track every step to
                resolution.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3.5 shrink-0">
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex items-center justify-center gap-2.5 px-7 py-4 text-sm font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onSignIn}
                className="px-5 py-2.5 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Already have an account? Sign In
              </button>
            </div>
          </motion.div>

          {/* Optional Unobtrusive Reference Tracker Toggle */}
          <div className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                Already filed a complaint reference?
              </p>
              <p className="text-xs text-slate-500">
                Check the status timeline of an existing UrbanFix reference number.
              </p>
            </div>

            {!lookupOpen ? (
              <button
                type="button"
                onClick={() => setLookupOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-teal-700" />
                <span>Track by Reference ID</span>
              </button>
            ) : (
              <form
                onSubmit={handleTrackLookup}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto"
              >
                <input
                  type="text"
                  value={trackingRef}
                  onChange={(e) => {
                    setTrackingRef(e.target.value);
                    setTrackingError(null);
                  }}
                  placeholder="e.g., UF-2026-1042"
                  aria-label="Complaint Reference ID"
                  className="px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="submit"
                  disabled={trackingLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {trackingLoading ? 'Checking...' : 'Check Status'}
                </button>
              </form>
            )}
          </div>
          {trackingError && (
            <p className="text-xs text-red-700 -mt-14">{trackingError}</p>
          )}

          {/* Minimal Footer with Project Information */}
          <footer className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
            <div className="space-y-1">
              <div className="font-display font-bold text-slate-900 text-sm">UrbanFix</div>
              <p>
                Civic Service Complaint Management Platform · College Software Engineering Project.
              </p>
              <p className="text-[11px] text-slate-400">
                Academic civic-technology prototype using illustrative ward localities; not
                affiliated with any municipal authority.
              </p>
            </div>

            <div className="flex items-center gap-5 shrink-0">
              <button
                type="button"
                onClick={onSignIn}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={onGetStarted}
                className="font-semibold text-teal-700 hover:text-teal-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
};
