import { AddToIphoneCard } from "../components/AddToIphoneCard";
import { PwaInstallCard } from "../components/PwaInstallCard";

export function Device() {
  return (
    <div className="animate-rise space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Device & Integration
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
          Pasang LifePlanner di ponsel, tablet, atau komputer Anda dengan skema PWA, serta hubungkan integrasi iOS Shortcut untuk pencatatan otomatis.
        </p>
      </div>

      <div className="grid gap-6">
        <PwaInstallCard />
        <AddToIphoneCard />
      </div>
    </div>
  );
}