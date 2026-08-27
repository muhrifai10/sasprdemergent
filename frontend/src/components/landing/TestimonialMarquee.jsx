import React, { useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useTransform } from "framer-motion";
import "./TestimonialMarquee.css";

function wrap(min, max, v) {
  const rangeSize = max - min;
  return (((v - min) % rangeSize) + rangeSize) % rangeSize + min;
}

function TestimonialCard({ name, avatar, text, cardWidth, avatarSize }) {
  return (
    <div className="testimonial-card" style={{ width: cardWidth }}>
      <img className="testimonial-avatar" src={avatar} alt={name} style={{ width: avatarSize, height: avatarSize }} draggable={false} />
      <div className="testimonial-content">
        <p className="testimonial-name">{name}</p>
        <p className="testimonial-text">{text}</p>
      </div>
    </div>
  );
}

function MarqueeRow({ items, direction, speed, pauseOnHover, gap, cardWidth, avatarSize }) {
  const baseX = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);
  const velocity = useRef(1);

  useAnimationFrame((_, delta) => {
    const target = pauseOnHover && isHovered ? 0 : 1;
    velocity.current += (target - velocity.current) * 0.08;
    const percentPerSecond = 50 / speed;
    const moveBy = direction * percentPerSecond * velocity.current * (Math.min(delta, 50) / 1000);
    baseX.set(baseX.get() + moveBy);
  });

  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);

  return (
    <div className="marquee-row" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <motion.div className="marquee-track" style={{ x }}>
        {[items, items].map((group, groupIndex) => (
          <div key={groupIndex} className="marquee-group" style={{ gap, paddingRight: gap }}>
            {group.map((item, i) => (
              <TestimonialCard key={`${groupIndex}-${item.name}-${i}`} name={item.name} avatar={item.avatar} text={item.text} cardWidth={cardWidth} avatarSize={avatarSize} />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function TestimonialMarquee({
  rows = [],
  speed = 45,
  pauseOnHover = true,
  gap = "1.5rem",
  cardWidth = "420px",
  avatarSize = "64px",
  reverseFirstRow = false,
}) {
  return (
    <div className="marquee-section" data-testid="testimonial-marquee">
      {rows.map((items, index) => {
        const baseDirection = index % 2 === 0 ? 1 : -1;
        const direction = reverseFirstRow ? -baseDirection : baseDirection;
        return <MarqueeRow key={index} items={items} direction={direction} speed={speed} pauseOnHover={pauseOnHover} gap={gap} cardWidth={cardWidth} avatarSize={avatarSize} />;
      })}
    </div>
  );
}
