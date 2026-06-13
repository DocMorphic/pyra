"use client";

import { useState, useRef, useEffect } from "react";
import { useWindowManager } from "@/hooks/use-window-manager";
import { useModal } from "@/hooks/use-modal";
import { STORAGE_PREFIX } from "@/lib/constants";
import { useClock } from "@/hooks/use-clock";
import { Sunny } from "@/components/ui/Sunny";
import { BrightnessPopover } from "./BrightnessPopover";

const CMD_KEY =
  typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

function performReset() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(`${STORAGE_PREFIX}:`));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
  window.location.reload();
}

export function MenuBar() {
  const {
    openWindow,
    closeWindow,
    minimizeWindow,
    centerWindow,
    maximizeWindow,
    getFocusedAppId,
  } = useWindowManager();
  const { confirm } = useModal();
  const clock = useClock();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleResetSystem = async () => {
    const ok = await confirm({
      title: "Reset PyraOS?",
      message:
        "Clears local preferences (theme, accent, brightness, window layout) and reloads. Plant data and analytics are untouched.",
      confirmLabel: "Reset",
      danger: true,
    });
    if (ok) performReset();
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const focusedAppId = getFocusedAppId();
  const anyMenuOpen = openMenu === "pyra" || openMenu === "plant" || openMenu === "view";

  return (
    <div
      ref={menuRef}
      className="relative z-[600] flex h-[34px] items-stretch justify-between border-b pr-3"
      style={{
        background: "var(--color-menubar-bg)",
        borderColor: "var(--color-menubar-border)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-stretch">
        {/* Logo — Sunny, Pyra's mascot */}
        <div className="ml-3 mr-1 flex items-center" aria-hidden>
          <Sunny size={22} />
        </div>

        <MenuButton
          label="Pyra"
          isOpen={openMenu === "pyra"}
          onClick={() => setOpenMenu(openMenu === "pyra" ? null : "pyra")}
          onHoverOpen={() => setOpenMenu("pyra")}
          anyMenuOpen={anyMenuOpen}
          className="ml-1"
          bold
        >
          <MenuItem
            label="About Pyra"
            onClick={() => {
              openWindow("about");
              setOpenMenu(null);
            }}
          />
          <MenuDivider />
          <MenuItem
            label="Settings…"
            onClick={() => {
              openWindow("settings");
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Reset PyraOS"
            onClick={() => {
              setOpenMenu(null);
              void handleResetSystem();
            }}
          />
        </MenuButton>

        <MenuButton
          label="Plant"
          isOpen={openMenu === "plant"}
          onClick={() => setOpenMenu(openMenu === "plant" ? null : "plant")}
          onHoverOpen={() => setOpenMenu("plant")}
          anyMenuOpen={anyMenuOpen}
          className="ml-1"
        >
          <MenuItem
            label="Plant Map"
            onClick={() => {
              openWindow("plant-map");
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Loss Ledger"
            onClick={() => {
              openWindow("loss-ledger");
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Inverter Inspector"
            onClick={() => {
              openWindow("inspector");
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Fault Timeline"
            onClick={() => {
              openWindow("timeline");
              setOpenMenu(null);
            }}
          />
          <MenuDivider />
          <MenuItem
            label="O&M Copilot"
            onClick={() => {
              openWindow("copilot");
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Methods & Validation"
            onClick={() => {
              openWindow("methods");
              setOpenMenu(null);
            }}
          />
          <MenuItem
            label="Executive Report"
            onClick={() => {
              openWindow("report");
              setOpenMenu(null);
            }}
          />
        </MenuButton>

        <MenuButton
          label="View"
          isOpen={openMenu === "view"}
          onClick={() => setOpenMenu(openMenu === "view" ? null : "view")}
          onHoverOpen={() => setOpenMenu("view")}
          anyMenuOpen={anyMenuOpen}
          className="ml-1"
        >
          <MenuItem
            label="Refresh"
            shortcut={`${CMD_KEY}+R`}
            onClick={() => window.location.reload()}
          />
          <MenuItem
            label="Maximize"
            onClick={() => {
              if (focusedAppId) maximizeWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
          <MenuItem
            label="Minimize"
            onClick={() => {
              if (focusedAppId) minimizeWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
          <MenuItem
            label="Close Window"
            onClick={() => {
              if (focusedAppId) closeWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
          <MenuDivider />
          <MenuItem
            label="Center Window"
            onClick={() => {
              if (focusedAppId) centerWindow(focusedAppId);
              setOpenMenu(null);
            }}
            disabled={!focusedAppId}
          />
        </MenuButton>
      </div>

      <div className="flex items-center gap-2.5 pr-1">
        <button
          className="ph-btn red hidden text-[12px] sm:inline-flex"
          style={{ padding: "5px 14px" }}
          onClick={() => openWindow("report")}
        >
          Live demo
        </button>
        <button className="ph-tool" aria-label="Search" title="Search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
        </button>
        <span
          className="hidden items-center text-[11.5px] tabular-nums md:flex"
          style={{ color: "var(--color-menubar-text)" }}
        >
          {clock}
        </span>
        <div className="relative flex items-center">
          <DisplayButton
            isOpen={openMenu === "brightness"}
            onClick={() => setOpenMenu(openMenu === "brightness" ? null : "brightness")}
          />
          {openMenu === "brightness" && (
            <BrightnessPopover onClose={() => setOpenMenu(null)} />
          )}
        </div>
      </div>
    </div>
  );
}

function MenuButton({
  label,
  isOpen,
  onClick,
  onHoverOpen,
  anyMenuOpen,
  className,
  bold,
  children,
}: {
  label: string;
  isOpen: boolean;
  onClick: () => void;
  onHoverOpen: () => void;
  anyMenuOpen: boolean;
  className?: string;
  bold?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const bg = isOpen
    ? "var(--color-menubar-active)"
    : hover
    ? "var(--color-menubar-hover)"
    : "transparent";
  return (
    <div className={`relative flex items-center ${className ?? ""}`}>
      <button
        className="rounded px-2.5 py-1 text-[12.5px] transition-colors"
        style={{
          background: bg,
          color: "var(--color-menubar-text)",
          fontWeight: bold ? 600 : 500,
        }}
        onMouseEnter={() => {
          setHover(true);
          if (anyMenuOpen && !isOpen) onHoverOpen();
        }}
        onMouseLeave={() => setHover(false)}
        onClick={onClick}
      >
        {label}
      </button>
      {isOpen && (
        <div
          className="menu-dropdown absolute left-0 top-full mt-1 min-w-[200px] border p-1"
          style={{
            background: "var(--color-surface-solid)",
            borderColor: "var(--color-border)",
            borderRadius: 6,
            boxShadow: "0 8px 24px var(--color-window-shadow)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[12px] transition-colors"
      style={{
        color: disabled ? "var(--color-text-dim)" : "var(--color-text)",
        cursor: disabled ? "default" : "pointer",
      }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--color-accent)";
          e.currentTarget.style.color = "#ffffff";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--color-text)";
        }
      }}
    >
      <span>{label}</span>
      {shortcut && (
        <span className="ml-6 text-[10.5px] opacity-60">{shortcut}</span>
      )}
    </button>
  );
}

function MenuDivider() {
  return (
    <div
      className="mx-2 my-1 h-px"
      style={{ background: "var(--color-border)" }}
    />
  );
}

function DisplayButton({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = isOpen
    ? "var(--color-menubar-active)"
    : hover
    ? "var(--color-menubar-hover)"
    : "transparent";
  return (
    <button
      className="flex h-[24px] w-[24px] items-center justify-center rounded transition-colors"
      style={{ background: bg }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      aria-label="Display settings"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-menubar-text)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    </button>
  );
}
