"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Stars } from "@react-three/drei";

import { Earth } from "./Earth";
import { InteractiveParticles } from "./InteractiveParticles";

export function Scene3D() {
  return (
    <Canvas
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 5.4], fov: 38 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.05} />
      <directionalLight position={[5, 3, 5]} intensity={2.5} color="#ffffff" />
      <Suspense
        fallback={
          <Stars
            radius={80}
            depth={40}
            count={5000}
            factor={3.5}
            saturation={0}
            fade
            speed={0.4}
          />
        }
      >
        <Environment
          background
          files="/textures/night_sky_stars.hdr"
        />
        <Earth />
      </Suspense>
      <InteractiveParticles />
    </Canvas>
  );
}
