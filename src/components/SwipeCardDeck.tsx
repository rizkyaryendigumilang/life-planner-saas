import React, { useState, useEffect, useCallback } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Eye, EyeOff, Copy, Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import "./swipe-card.css";
import type { BankAccount } from "../types";

/**
 * Format nomor kartu atau rekening berjarak per 4 digit atau disamarkan (masked)
 */
export function formatCardNumber(value?: string, isRevealed: boolean = false): string {
  if (!value || !value.trim()) return "•••• •••• •••• ••••";
  const clean = String(value).replace(/\s+/g, "");

  if (isRevealed) {
    return clean.match(/.{1,4}/g)?.join(" ") || clean;
  }

  const digits = clean.replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)} •••• •••• ${digits.slice(-4)}`;
  }
  if (digits.length >= 4) {
    return `•••• •••• •••• ${digits.slice(-4)}`;
  }
  return `•••• •••• ${clean}`;
}

/**
 * Pemetaan warna gradasi kartu berdasarkan bank atau tipe akun
 */
export function getBankGradient(bankName: string = "", accountType: string = "", index: number = 0): string {
  const normalized = bankName.toLowerCase();

  if (normalized.includes("bca")) {
    return "linear-gradient(135deg, #0056b3 0%, #001f44 100%)";
  }
  if (normalized.includes("jago")) {
    return "linear-gradient(135deg, #fa5a00 0%, #8c2e00 100%)";
  }
  if (normalized.includes("mandiri")) {
    return "linear-gradient(135deg, #0f4c81 0%, #082238 100%)";
  }
  if (normalized.includes("bni")) {
    return "linear-gradient(135deg, #006666 0%, #002e2e 100%)";
  }
  if (normalized.includes("bri")) {
    return "linear-gradient(135deg, #00529c 0%, #002b52 100%)";
  }
  if (normalized.includes("bsi") || normalized.includes("syariah")) {
    return "linear-gradient(135deg, #00a39d 0%, #084c4a 100%)";
  }
  if (normalized.includes("cimb") || normalized.includes("niaga")) {
    return "linear-gradient(135deg, #8b0000 0%, #4a0000 100%)";
  }
  if (normalized.includes("jenius") || normalized.includes("btpn")) {
    return "linear-gradient(135deg, #00a8e8 0%, #004e7c 100%)";
  }
  if (accountType === "E-Wallet" || /gopay|ovo|dana|shopee|linkaja/i.test(normalized)) {
    return "linear-gradient(135deg, #4f46e5 0%, #1e1b4b 100%)";
  }

  const defaultGradients = [
    "linear-gradient(135deg, #18181b 0%, #09090b 100%)", // Noir Obsidian
    "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", // Slate Navy
    "linear-gradient(135deg, #064e3b 0%, #022c22 100%)", // Deep Emerald
    "linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)", // Deep Indigo
    "linear-gradient(135deg, #3b0764 0%, #1e1b4b 100%)", // Royal Purple
    "linear-gradient(135deg, #292524 0%, #1c1917 100%)", // Warm Stone
  ];

  return defaultGradients[index % defaultGradients.length];
}

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getInitials(name: string) {
  if (!name || !name.trim()) return "AC";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export interface SwipeableCardProps {
  item: BankAccount;
  index: number;
  total: number;
  cardIndex?: number;
  onSwipe: (direction: "left" | "right") => void;
  onClick?: (item: BankAccount) => void;
  onEdit?: (item: BankAccount) => void;
  onDelete?: (item: BankAccount) => void;
  renderCard?: (item: BankAccount, state: { isActive: boolean; index: number }) => React.ReactNode;
}

/**
 * Komponen Single Card dengan gestur Drag & Spring Physics
 */
function SwipeableCard({
  item,
  index,
  total,
  cardIndex,
  onSwipe,
  onClick,
  onEdit,
  onDelete,
  renderCard,
}: SwipeableCardProps) {
  const x = useMotionValue(0);

  // Efek fisika: Kartu miring sedikit saat ditarik ke kiri/kanan (-8deg s/d +8deg)
  const rotate = useTransform(x, [-200, 200], [-8, 8]);

  // Efek kedalaman tumpukan 3D: Kartu di belakang lebih kecil dan sedikit naik ke atas
  const scale = 1 - index * 0.04;
  const y = -index * 12;
  const zIndex = total - index;
  const isActive = index === 0;

  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  // Reset posisi saat giliran kartu berganti
  useEffect(() => {
    x.set(0);
    setShowFull(false);
  }, [index, item.id, x]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.account_number) return;
    try {
      await navigator.clipboard.writeText(item.account_number);
      setCopied(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(10);
        } catch {
          // ignore vibration errors
        }
      }
      toast.success("Nomor rekening/kartu berhasil disalin!");
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Gagal menyalin nomor kartu.");
    }
  };

  const backgroundGradient = getBankGradient(item.bank_name, item.account_type, index);

  return (
    <motion.div
      className={`swipe-card ${isActive ? "is-active" : "is-background"}`}
      style={{
        x,
        y,
        scale,
        rotate,
        zIndex,
        background: backgroundGradient,
      }}
      // Hanya kartu teratas yang dapat digeser
      drag={isActive && total > 1 ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.35} // Resistensi elastis kenyal
      whileTap={isActive && total > 1 ? { cursor: "grabbing" } : undefined}
      onClick={() => {
        if (isActive && onClick) onClick(item);
      }}
      onDragEnd={(_, info) => {
        if (total <= 1) return;
        // Trigger swipe jika jarak geser > 60px ATAU kecepatan flick > 300px/s
        const isFlick = Math.abs(info.velocity.x) > 300;
        const isPassedThreshold = Math.abs(info.offset.x) > 60;
        if (isFlick || isPassedThreshold) {
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate(15);
            } catch {
              // ignore
            }
          }
          onSwipe(info.offset.x > 0 ? "right" : "left");
        }
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
    >
      {renderCard ? (
        renderCard(item, { isActive, index })
      ) : (
        <>
          {/* Glossy Overlay Shine Effect */}
          <div className="card-gloss-overlay" />
          <div className="card-shine-circle-1" />
          <div className="card-shine-circle-2" />

          {/* Top Header: Issuer & Brand Badge */}
          <div className="card-top-row">
            <div className="card-issuer-group">
          <span className="card-issuer">{item.bank_name || "BANK NAME"}</span>
          <span className="card-name">{item.account_name || "Card Title"}</span>
        </div>
        <div className="card-brand-badge">{item.account_type || "DEBIT"}</div>
      </div>

      {/* Chip & Contactless Waves */}
      <div className="card-chip-row">
        <div className="card-chip" />
        <span className="card-contactless" title="Contactless">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M8.5 16.5a5 5 0 0 1 0-7" />
            <path d="M12 19a8.5 8.5 0 0 1 0-12" />
            <path d="M15.5 21.5a12 12 0 0 1 0-17" />
          </svg>
        </span>
      </div>

      {/* Card / Account Number */}
      <div className="card-number">
        {formatCardNumber(item.account_number, showFull)}
      </div>

      {/* Meta: Recorded Balance & Bank Initials */}
      <div className="card-meta-row">
        <div className="card-meta-holder">
          <span className="card-label">RECORDED BALANCE</span>
          <strong className="card-balance-val">
            {formatIDR(Number(item.balance || 0))}
          </strong>
        </div>

        <div className="card-meta-side">
          <div className="card-initials-badge">
            {getInitials(item.bank_name)}
          </div>
        </div>
      </div>

      {/* Bottom Quick Actions & Indicator */}
      <div className="card-actions-row" onClick={(e) => e.stopPropagation()}>
        <div className="card-action-buttons">
          <button
            type="button"
            className="card-mini-btn"
            title={showFull ? "Sembunyikan nomor" : "Tampilkan nomor"}
            onClick={() => setShowFull((v) => !v)}
            aria-label={showFull ? "Sembunyikan nomor kartu" : "Tampilkan nomor kartu"}
          >
            {showFull ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>

          {item.account_number && (
            <button
              type="button"
              className="card-mini-btn"
              title="Salin nomor kartu"
              onClick={handleCopy}
              aria-label="Salin nomor kartu"
            >
              {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              className="card-mini-btn"
              title="Edit akun"
              onClick={() => onEdit(item)}
              aria-label="Edit akun"
            >
              <Pencil size={12} />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              className="card-mini-btn hover:bg-rose-500/30 text-rose-200"
              title="Hapus akun"
              onClick={() => onDelete(item)}
              aria-label="Hapus akun"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <span className="card-index-count">
          {(cardIndex !== undefined ? cardIndex + 1 : total - index)} / {total}
        </span>
      </div>

      {/* Inactive Overlay */}
      {item.status === "Inactive" && (
        <div className="card-inactive-overlay">
          <span className="card-inactive-pill">Inactive</span>
        </div>
      )}
        </>
      )}
    </motion.div>
  );
}

export interface SwipeCardDeckProps {
  items?: BankAccount[];
  cards?: BankAccount[];
  currentIndex?: number;
  onCardClick?: (item: BankAccount) => void;
  onIndexChange?: (index: number, item: BankAccount) => void;
  onEditAccount?: (item: BankAccount) => void;
  onDeleteAccount?: (item: BankAccount) => void;
  renderCard?: (item: BankAccount, state: { isActive: boolean; index: number }) => React.ReactNode;
  className?: string;
  emptyMessage?: string;
}

/**
 * Komponen Deck Pembungkus 3D Swipe Card Deck
 */
export default function SwipeCardDeck({
  items,
  cards,
  currentIndex: controlledIndex,
  onCardClick,
  onIndexChange,
  onEditAccount,
  onDeleteAccount,
  renderCard,
  className = "",
  emptyMessage = "Belum ada akun rekening.",
}: SwipeCardDeckProps) {
  const accountList = items || cards || [];
  const [internalIndex, setInternalIndex] = useState(0);

  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

  const safeIndex =
    accountList.length > 0
      ? ((activeIndex % accountList.length) + accountList.length) % accountList.length
      : 0;

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      if (accountList.length <= 1) return;
      const delta = direction === "left" ? 1 : -1;
      const next = (safeIndex + delta + accountList.length) % accountList.length;

      if (controlledIndex === undefined) {
        setInternalIndex(next);
      }
      if (onIndexChange) {
        onIndexChange(next, accountList[next]);
      }
    },
    [accountList, controlledIndex, onIndexChange, safeIndex]
  );

  const handleDotClick = useCallback(
    (index: number) => {
      if (controlledIndex === undefined) {
        setInternalIndex(index);
      }
      if (onIndexChange) {
        onIndexChange(index, accountList[index]);
      }
    },
    [accountList, controlledIndex, onIndexChange]
  );

  if (!accountList || accountList.length === 0) {
    return <div className="py-8 text-center text-xs text-ink-soft">{emptyMessage}</div>;
  }

  return (
    <div className={`card-deck-container ${className}`}>
      {/* Kotak Tumpukan Kartu dengan Perspektif 3D */}
      <div className="card-deck-stack">
        {accountList.map((card, i) => {
          // Posisi relatif terhadap kartu paling aktif
          const position = (i - safeIndex + accountList.length) % accountList.length;

          // Render hanya 3 kartu teratas untuk performa fluid 60/120 FPS
          if (position > 2) return null;

          return (
            <SwipeableCard
              key={card.id || i}
              item={card}
              index={position}
              cardIndex={i}
              total={accountList.length}
              onSwipe={handleSwipe}
              onClick={onCardClick}
              onEdit={onEditAccount}
              onDelete={onDeleteAccount}
              renderCard={renderCard}
            />
          );
        })}
      </div>

      {/* Pagination Dots */}
      {accountList.length > 1 && (
        <div className="deck-dots" role="tablist" aria-label="Card pagination">
          {accountList.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`deck-dot ${i === safeIndex ? "active" : ""}`}
              onClick={() => handleDotClick(i)}
              aria-label={`Kartu ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
