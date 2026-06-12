"use client";

import { useEffect } from "react";
import { ThemeContext, useThemeProvider } from "@/hooks/use-theme";
import {
  WindowManagerContext,
  useWindowManagerProvider,
} from "@/hooks/use-window-manager";
import { ModalContext, useModalProvider } from "@/hooks/use-modal";
import { PyraDataProvider } from "@/hooks/use-pyra-data";
import { BootScreen } from "./BootScreen";
import { MenuBar } from "./MenuBar";
import { Taskbar } from "./Taskbar";
import { Wallpaper } from "./Wallpaper";
import { DesktopIcons } from "./DesktopIcons";
import { Modal } from "@/components/ui/Modal";
import { Window } from "@/components/window/Window";
import { APP_REGISTRY } from "@/lib/constants";

import { PlantMapApp } from "@/components/apps/PlantMapApp";
import { LossLedgerApp } from "@/components/apps/LossLedgerApp";
import { InverterInspectorApp } from "@/components/apps/InverterInspectorApp";
import { FaultTimelineApp } from "@/components/apps/FaultTimelineApp";
import { CopilotApp } from "@/components/apps/CopilotApp";
import { ExecutiveReportApp } from "@/components/apps/ExecutiveReportApp";
import { MethodsApp } from "@/components/apps/MethodsApp";
import { SettingsApp } from "@/components/apps/SettingsApp";
import { AboutApp } from "@/components/apps/AboutApp";

const APP_COMPONENTS: Record<string, React.ComponentType> = {
  "plant-map": PlantMapApp,
  "loss-ledger": LossLedgerApp,
  inspector: InverterInspectorApp,
  timeline: FaultTimelineApp,
  copilot: CopilotApp,
  methods: MethodsApp,
  report: ExecutiveReportApp,
  settings: SettingsApp,
  about: AboutApp,
};

export function Desktop() {
  const theme = useThemeProvider();
  const windowManager = useWindowManagerProvider();
  const modal = useModalProvider();

  // Open the money headline + plant overview on boot so the demo lands
  // straight on the value.
  useEffect(() => {
    windowManager.openWindow("loss-ledger");
    windowManager.openWindow("plant-map");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const focused = windowManager.getFocusedAppId();
        if (focused) windowManager.closeWindow(focused);
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey) {
        const focused = windowManager.getFocusedAppId();
        const key = e.key.toLowerCase();
        if (key === "w" && focused) {
          e.preventDefault();
          windowManager.closeWindow(focused);
        } else if (key === "f" && focused) {
          e.preventDefault();
          windowManager.maximizeWindow(focused);
        } else if (key === "m" && focused) {
          e.preventDefault();
          windowManager.minimizeWindow(focused);
        } else if (key === "c" && focused) {
          e.preventDefault();
          windowManager.centerWindow(focused);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [windowManager]);

  return (
    <ThemeContext value={theme}>
      <WindowManagerContext value={windowManager}>
        <ModalContext value={modal}>
          <PyraDataProvider>
          <BootScreen />
          <div className="desktop-brightness relative h-dvh w-full select-none">
            <Wallpaper />
            <MenuBar />

            <div
              id="desktop-content"
              className="absolute inset-0 bottom-0"
              style={{ top: "34px" }}
              tabIndex={-1}
            >
              <DesktopIcons />

              <div className="absolute inset-0 overflow-hidden">
                {windowManager.windows
                  .filter((w) => w.isOpen && !w.isMinimized)
                  .map((w) => {
                    const AppComponent = APP_COMPONENTS[w.appId];
                    const appDef = APP_REGISTRY[w.appId];
                    if (!AppComponent || !appDef) return null;
                    return (
                      <Window key={w.appId} appId={w.appId}>
                        <AppComponent />
                      </Window>
                    );
                  })}
              </div>
            </div>

            <Taskbar />

            {modal._active && (
              <Modal
                open={true}
                title={modal._active.title}
                message={modal._active.message}
                variant={modal._active.danger ? "danger" : "neutral"}
                onDismiss={() => modal._dismiss(false)}
                actions={
                  modal._active.isConfirm
                    ? [
                        {
                          label: modal._active.cancelLabel ?? "Cancel",
                          onClick: () => modal._dismiss(false),
                          variant: "secondary",
                        },
                        {
                          label: modal._active.confirmLabel ?? "Confirm",
                          onClick: () => modal._dismiss(true),
                          variant: modal._active.danger ? "danger" : "primary",
                        },
                      ]
                    : [
                        {
                          label: modal._active.confirmLabel ?? "OK",
                          onClick: () => modal._dismiss(true),
                          variant: "primary",
                        },
                      ]
                }
              />
            )}
          </div>
          </PyraDataProvider>
        </ModalContext>
      </WindowManagerContext>
    </ThemeContext>
  );
}
