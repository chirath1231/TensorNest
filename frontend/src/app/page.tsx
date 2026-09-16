import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { StackMarquee } from "@/components/landing/StackMarquee";
import { Features } from "@/components/landing/Features";
import { ScrollBanner } from "@/components/landing/ScrollBanner";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ComputeTiers } from "@/components/landing/ComputeTiers";
import { Faq } from "@/components/landing/Faq";
import { CtaBand } from "@/components/landing/CtaBand";
import { SiteFooter } from "@/components/landing/SiteFooter";

export const metadata: Metadata = {
  // Absolute, so the root does not come out as "TensorNest · TensorNest"
  // under the layout's "%s · TensorNest" template.
  title: { absolute: "TensorNest — training that outlives the tab" },
  description:
    "Cloud ML training that keeps running after you close the browser. Submit a script, close the tab, come back to the status, logs and checkpoints.",
};

/** The public front door.
 *
 *  Server-rendered on purpose: the sections below it are client components
 *  because they animate, but the page itself has no auth dependency, so a
 *  first-time visitor gets markup rather than a redirect. Signed-in visitors
 *  are not bounced to /dashboard either — the nav offers it instead, which
 *  leaves the landing page reachable for someone who has an account and just
 *  wants to read it. */
export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <StackMarquee />
        <Features />
        <ScrollBanner />
        <HowItWorks />
        <ComputeTiers />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
