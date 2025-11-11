import React from 'react';
import Layout from '../layout/Layout.jsx';
import useAuth from '../../data/useAuth.js';
import { HomeSEO } from '../SEO.jsx';
import { Link } from 'react-router-dom';
import CountdownTimer from './CountdownTimer.jsx';
import LiquidEther from '../ui/LiquidEther.jsx';
import useThemePreference from '../../hooks/useThemePreference.js';

export default function Home() {
  const auth = useAuth();
  const { dark } = useThemePreference();
  const isLight = !dark;
  return (
    <div className="min-h-screen app-radial-bg dark:app-radial-bg transition-colors glass-backdrop relative">
      <HomeSEO />
      {/* Full-page liquid background, fixed to viewport, behind all content */}
      <div className="fixed inset-0 z-0">
        <LiquidEther
          colors={isLight ? ['#2240c5ff', '#3b82f6', '#06b6d4'] : ['#5227FF', '#FF9FFC', '#B19EEF']}
          backgroundColor={isLight ? '#ffffff' : 'transparent'}
          mouseForce={isLight ? 8 : 28}
          cursorSize={100}
          isViscous={false}
          viscous={30}
          iterationsViscous={32}
          iterationsPoisson={32}
          resolution={0.6}
          isBounce={true}
          autoDemo={true}
          autoSpeed={isLight ? 0.3 : 0.5}
          autoIntensity={2.0}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>

      {/* Foreground app content */}
      <div className="relative z-10">
        <Layout auth={auth}>
  <section id="home-hero" className="flex flex-col items-center justify-start text-center pt-12 sm:pt-16 md:pt-20 pb-8 sm:pb-10 md:pb-12">
          <div className="space-y-6">
            <h1 className="font-extrabold tracking-tight text-[#121930] dark:text-white">
              <span className="inline-flex items-center justify-center gap-0 text-[2.6rem] sm:text-6xl md:text-7xl">
    <span>at</span>
      <img id="home-logo"
                  src="/logo.png"
                  alt="atom"
                  className="inline-block align-baseline"
                          style={{ height: '1.7em', width: 'auto', margin: '0 -14px', transform: 'translateY(2px)' }}
                />
                <span>mbowl</span>
              </span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-black/70 dark:text-white/70">
              the premier science bowl experience
            </p>
            <div className="pt-2">
              <Link to="/round-generator" className="btn btn-fancy text-lg">
                Get started
              </Link>
            </div>
            {/* Countdown moved into hero so it is fully visible on first load */}
            <div className="mt-6">
              <CountdownTimer />
            </div>
          </div>
        </section>


        {/* Features section */}
        <section id="features" className="max-w-6xl mx-auto px-3 sm:px-4 pt-6 sm:pt-8 md:pt-10 pb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-[#121930] dark:text-white mb-6 sm:mb-10">
            what you can do
          </h2>
          <div className="grid gap-4 sm:gap-6 md:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="round generator"
              desc="Build custom practice rounds from curated tournaments and categories in seconds."
              to="/round-generator"
              cta="Generate rounds"
            />
            <FeatureCard
              title="practice mode"
              desc="Drill toss-ups and bonuses with keyboard-friendly controls and instant feedback."
              to="/practice"
              cta="Start practicing"
            />
            <FeatureCard
              title="multiplayer rooms"
              desc="Create or join live rooms to buzz, chat, and practice together online."
              to="/multiplayer"
              cta="Host or join"
            />
            <FeatureCard
              title="buzzer"
              desc="Simple real-time buzzer for scrims — share a code and you’re in."
              to="/buzzer"
              cta="Open buzzer"
            />
            <FeatureCard
              title="save & review"
              desc="Save generated rounds to your account and review them any time."
              to="/round-generator"
              cta="Save rounds"
            />
            <FeatureCard
              title="visual bonuses"
              desc="View supported visual bonus questions with images when available."
              to="/round-generator"
              cta="See visuals"
            />
          </div>
        </section>
      </Layout>
      </div>
    </div>
  );
}

function FeatureCard({ title, desc, to, cta }) {
  return (
    <div className="glass p-6 rounded-2xl h-full flex flex-col justify-between hover-lift">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-[#121930] dark:text-white">{title}</h3>
        <p className="text-black/70 dark:text-white/70 text-sm leading-relaxed">{desc}</p>
      </div>
      <div className="pt-4">
        <Link to={to} className="btn btn-outline-fancy">
          {cta}
        </Link>
      </div>
    </div>
  );
}
