"use client";

import LightRays from "@/components/LightRays";

export default function LightRaysBackground() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        width: "100vw",
        height: "100vh",
        background: "#120F17",
      }}
    >
      <LightRays
        raysOrigin="top-center"
        raysColor="#55A336"
        raysSpeed={0.8}
        lightSpread={0.8}
        rayLength={3}
        pulsating={true}
        fadeDistance={2}
        saturation={1.2}
        followMouse={true}
        mouseInfluence={0.15}
        noiseAmount={0.2}
        distortion={0.2}
      />
    </div>
  );
}
