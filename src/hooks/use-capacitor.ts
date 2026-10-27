import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { Page } from "../components/layout";

export function useCapacitor({
  page,
  onNavigate,
  isDark,
}: {
  page?: Page;
  onNavigate?: (page: Page) => void;
  isDark?: boolean;
}) {
  const isNative = Capacitor.isNativePlatform();

  // 1. Sync Native Status Bar dengan tema aplikasi
  useEffect(() => {
    if (!isNative) return;

    const syncStatusBar = async () => {
      try {
        await StatusBar.setStyle({
          style: isDark ? Style.Dark : Style.Light,
        });

        // Pada Android, atur warna background status bar sesuai tema
        if (Capacitor.getPlatform() === "android") {
          await StatusBar.setBackgroundColor({
            color: isDark ? "#09090b" : "#ffffff",
          });
        }
      } catch (err) {
        // Abaikan jika status bar plugin tidak tersedia di web/preview
      }
    };

    syncStatusBar();
  }, [isNative, isDark]);

  // 2. Tangani Hardware Back Button di Android
  useEffect(() => {
    if (!isNative) return;

    let removeListener: (() => void) | undefined;

    const setupBackButton = async () => {
      try {
        const handler = await App.addListener("backButton", () => {
          // A. Jika ada dialog atau modal terbuka, tutup dialog terlebih dahulu
          const activeBackdrop = document.querySelector<HTMLElement>(".dialog-backdrop");
          if (activeBackdrop) {
            // Simulasikan penekanan tombol Escape untuk menutup dialog aktif
            const escEvent = new KeyboardEvent("keydown", {
              key: "Escape",
              code: "Escape",
              keyCode: 27,
              which: 27,
              bubbles: true,
            });
            document.dispatchEvent(escEvent);
            return;
          }

          // B. Jika drawer navigasi mobile terbuka, tutup
          const closeBtn = document.querySelector<HTMLButtonElement>('button[aria-label="Close menu"]');
          if (closeBtn && closeBtn.offsetParent !== null) {
            closeBtn.click();
            return;
          }

          // C. Jika berada di sub-halaman (bukan overview), kembali ke overview
          if (page && page !== "overview" && onNavigate) {
            onNavigate("overview");
            return;
          }

          // D. Jika sudah di overview, minimize app
          App.minimizeApp().catch(() => {});
        });

        removeListener = () => {
          handler.remove();
        };
      } catch (err) {
        // Abaikan error pada browser
      }
    };

    setupBackButton();

    return () => {
      if (removeListener) removeListener();
    };
  }, [isNative, page, onNavigate]);

  return {
    isNative,
    platform: Capacitor.getPlatform(),
  };
}
