"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface BackgroundBeamsProps {
  className?: string;
}

export function BackgroundBeams({ className }: BackgroundBeamsProps) {
  const paths = [
    "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875",
    "M-373 -197C-373 -197 -305 208 159 335C623 462 691 867 691 867",
    "M-366 -205C-366 -205 -298 200 166 327C630 454 698 859 698 859",
    "M-359 -213C-359 -213 -291 192 173 319C637 446 705 851 705 851",
    "M-352 -221C-352 -221 -284 184 180 311C644 438 712 843 712 843",
    "M-345 -229C-345 -229 -277 176 187 303C651 430 719 835 719 835",
    "M-338 -237C-338 -237 -270 168 194 295C658 422 726 827 726 827",
    "M-331 -245C-331 -245 -263 160 201 287C665 414 733 819 733 819",
    "M-324 -253C-324 -253 -256 152 208 279C672 406 740 811 740 811",
    "M-317 -261C-317 -261 -249 144 215 271C679 398 747 803 747 803",
    "M-310 -269C-310 -269 -242 136 222 263C686 390 754 795 754 795",
    "M-303 -277C-303 -277 -235 128 229 255C693 382 761 787 761 787",
  ];

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 696 316"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="beams-radial" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.03" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <filter id="beams-blur">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* Background radial glow */}
        <rect width="100%" height="100%" fill="url(#beams-radial)" />

        {/* Beam paths */}
        {paths.map((d, i) => (
          <g key={i}>
            {/* Dim base path */}
            <path
              d={d}
              stroke={`hsl(var(--foreground))`}
              strokeOpacity={0.04}
              strokeWidth="0.5"
            />
            {/* Animated bright segment */}
            <path
              d={d}
              stroke={`url(#beam-grad-${i})`}
              strokeWidth="1"
              filter="url(#beams-blur)"
              style={{
                animation: `beam ${6 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
            <defs>
              <linearGradient
                id={`beam-grad-${i}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="transparent" />
                <stop
                  offset="40%"
                  stopColor={i % 3 === 0 ? "#60a5fa" : i % 3 === 1 ? "#34d399" : "#a78bfa"}
                  stopOpacity="0.6"
                />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </g>
        ))}
      </svg>
    </div>
  );
}
