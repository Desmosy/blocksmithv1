"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";

const CELL_SIZE = 24; // 24px cells
const ROWS = 5;

const COLORS = [
  "bg-signal-orange",
  "bg-signal-orange", 
  "bg-signal-orange", 
  "bg-signal-orange", 
  "bg-signal-orange/80",
  "bg-signal-orange/60",
  "bg-yellow-200",
  "bg-yellow-200",
  "bg-ink-black",
  "bg-ink-black",
];

// Helper to generate a random data packet
const generatePacket = (id: number, maxCols: number) => {
  const row = Math.floor(Math.random() * ROWS);
  const cellWidth = Math.floor(Math.random() * 5) + 2;
  const width = cellWidth * CELL_SIZE;
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  
  let col = 0;
  const placementRoll = Math.random();
  if (placementRoll < 0.5) {
    col = Math.floor(Math.random() * Math.random() * (maxCols * 0.35));
  } else {
    const fromRightEdge = Math.floor(Math.random() * Math.random() * (maxCols * 0.35));
    col = Math.max(0, maxCols - cellWidth - fromRightEdge);
  }
  
  const left = col * CELL_SIZE;
  const origin = Math.random() < 0.5 ? "left" : "right";
  
  // Randomize the scroll bounds so they open at slightly different times
  const scrollStart = Math.random() * 0.3; // Starts opening between 0% and 30% of scroll
  const scrollEnd = 0.5 + Math.random() * 0.5; // Finishes opening between 50% and 100%

  return { id, row, width, color, left, origin, scrollStart, scrollEnd };
};

// Sub-component to manage individual scroll transforms
function Packet({ packet, scrollYProgress }: { packet: any, scrollYProgress: MotionValue<number> }) {
  // Map the container's scroll progress to this packet's scaleX
  const scaleX = useTransform(
    scrollYProgress,
    [packet.scrollStart, packet.scrollEnd],
    [0, 1]
  );

  return (
    <motion.div
      className={`absolute top-0 ${packet.color}`}
      style={{
        height: CELL_SIZE,
        width: packet.width,
        top: packet.row * CELL_SIZE,
        left: packet.left,
        transformOrigin: packet.origin,
        scaleX, // Driven completely by scroll!
      }}
    />
  );
}

export function AnimatedLightBoard() {
  const [packets, setPackets] = useState<any[]>([]);
  const [cols, setCols] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track the scroll progress of this specific component
  const { scrollYProgress } = useScroll({
    target: containerRef,
    // "start end" = top of element hits bottom of viewport (just comes into view)
    // "end start" = bottom of element hits top of viewport (just leaves view)
    offset: ["start end", "end start"]
  });

  useEffect(() => {
    const updateCols = () => {
      const calculatedCols = Math.ceil(window.innerWidth / CELL_SIZE) + 4;
      setCols(calculatedCols);
      
      const initialPackets = Array.from({ length: 32 }).map((_, i) => generatePacket(i, calculatedCols));
      setPackets(initialPackets);
    };
    
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-hidden bg-paper-white border-y border-lavender-mist"
      style={{ height: ROWS * CELL_SIZE }}
    >
      {/* Animated Data Packets Layer */}
      <div className="absolute inset-0 z-0">
        {packets.map((packet) => (
          <Packet key={packet.id} packet={packet} scrollYProgress={scrollYProgress} />
        ))}
      </div>

      {/* Grid Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="lightboard-grid-pattern" width={CELL_SIZE} height={CELL_SIZE} patternUnits="userSpaceOnUse">
              <path 
                d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`} 
                fill="none" 
                stroke="rgba(0,0,0,0.15)" 
                strokeWidth="1" 
                strokeDasharray="2 2"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lightboard-grid-pattern)" />
        </svg>
      </div>
      
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-black/5" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-black/5" />
    </div>
  );
}


