import React, { useCallback, useEffect, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

export type SwipeableItem = {
  id: string;
  [key: string]: any;
};

interface SwipeableCardProps<T extends SwipeableItem> {
  item: T;
  index: number;
  total: number;
  onSwipe: (direction: "left" | "right") => void;
  onClick?: (item: T) => void;
  renderCard?: (item: T, state: { isActive: boolean; index: number }) => React.ReactNode;
}

function BaseSwipeableCard<T extends SwipeableItem>({
  item,
  index,
  total,
  onSwipe,
  onClick,
  renderCard,
}: SwipeableCardProps<T>) {
  const x = useMotionValue(0);

  // Efek fisika: kartu miring sedikit saat digeser (-8deg s/d +8deg)
  const rotate = useTransform(x, [-200, 200], [-8, 8]);

  // Efek kedalaman tumpukan: kartu di belakang sedikit lebih kecil dan bergeser ke atas
  const scale = 1 - index * 0.04;
  const y = -index * 12;
  const zIndex = total - index;
  const isActive = index === 0;

  // Reset posisi x saat giliran kartu berubah
  useEffect(() => {
    x.set(0);
  }, [index, item.id, x]);

  return (
    <motion.div
      className={`absolute inset-0 select-none rounded-[26px] shadow-[0_16px_40px_rgba(0,0,0,0.14)] ${
        isActive ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
      }`}
      style={{
        x,
        y,
        scale,
        rotate,
        zIndex,
        touchAction: "pan-y",
        willChange: "transform",
        transform: "translate3d(0, 0, 0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
      }}
      drag={isActive && total > 1 ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.35}
      onClick={() => {
        if (isActive && onClick) onClick(item);
      }}
      onDragEnd={(_, info) => {
        if (total <= 1) return;

        const isFlick = Math.abs(info.velocity.x) > 300;
        const isPassedThreshold = Math.abs(info.offset.x) > 60;

        if (isFlick || isPassedThreshold) {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate(10);
            } catch {
              // Ignore if vibrate is not allowed
            }
          }
          onSwipe(info.offset.x > 0 ? "right" : "left");
        }
      }}
      whileTap={isActive && total > 1 ? { cursor: "grabbing" } : undefined}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
    >
      {renderCard ? (
        renderCard(item, { isActive, index })
      ) : (
        <div className="flex h-full w-full flex-col justify-between rounded-[26px] bg-ink p-6 text-surface">
          <h3>{item.title || item.name}</h3>
          <p>{item.subtitle || item.description}</p>
        </div>
      )}
    </motion.div>
  );
}

const SwipeableCard = React.memo(BaseSwipeableCard) as typeof BaseSwipeableCard;

export interface CardSwipeDeckProps<T extends SwipeableItem> {
  items?: T[];
  currentIndex?: number;
  onCardClick?: (item: T) => void;
  onIndexChange?: (index: number, item: T) => void;
  renderCard?: (item: T, state: { isActive: boolean; index: number }) => React.ReactNode;
  className?: string;
  emptyMessage?: string;
}

export default function CardSwipeDeck<T extends SwipeableItem>({
  items = [],
  currentIndex: controlledIndex,
  onCardClick,
  onIndexChange,
  renderCard,
  className = "",
  emptyMessage = "Tidak ada kartu.",
}: CardSwipeDeckProps<T>) {
  const [internalIndex, setInternalIndex] = useState(0);

  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

  const safeIndex = items.length > 0
    ? ((activeIndex % items.length) + items.length) % items.length
    : 0;

  const handleSwipe = useCallback((direction: "left" | "right") => {
    if (items.length <= 1) return;
    const delta = direction === "left" ? 1 : -1;
    const next = (safeIndex + delta + items.length) % items.length;

    if (controlledIndex === undefined) {
      setInternalIndex(next);
    }
    if (onIndexChange) {
      onIndexChange(next, items[next]);
    }
  }, [controlledIndex, items, onIndexChange, safeIndex]);

  const handleDotClick = useCallback((index: number) => {
    if (controlledIndex === undefined) {
      setInternalIndex(index);
    }
    if (onIndexChange) {
      onIndexChange(index, items[index]);
    }
  }, [controlledIndex, items, onIndexChange]);

  if (!items || items.length === 0) {
    return <div className="py-8 text-center text-xs text-ink-soft">{emptyMessage}</div>;
  }

  return (
    <div className={`mx-auto flex w-full max-w-[440px] flex-col items-center ${className}`}>
      {/* Kotak Tumpukan Kartu */}
      <div
        className="relative my-4 grid h-[240px] w-full place-items-center"
        style={{
          perspective: "1000px",
          transformStyle: "preserve-3d",
        }}
      >
        {items.map((item, i) => {
          // Posisi relatif terhadap kartu aktif
          const position = (i - safeIndex + items.length) % items.length;

          // Render maksimal 4 kartu teratas untuk performa optimal
          if (position > 3) return null;

          return (
            <SwipeableCard
              key={item.id || i}
              item={item}
              index={position}
              total={items.length}
              onSwipe={handleSwipe}
              onClick={onCardClick}
              renderCard={renderCard}
            />
          );
        })}
      </div>

      {/* Indikator Titik (Dots) di bawah */}
      {items.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Card index">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to card ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === safeIndex
                  ? "w-5 bg-ink"
                  : "w-1.5 bg-line/20 hover:bg-line/40"
              }`}
              onClick={() => handleDotClick(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
