interface WindowContentProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export function WindowContent({ children, noPadding }: WindowContentProps) {
  return (
    <div
      // The desktop root has `select-none` to prevent the OS chrome
      // (icons, dock, menubar) from accidentally selecting text on drag.
      // Window content needs the opposite — users want to copy protocol
      // steps, references, catalog #s. `select-text` on the wrapper
      // overrides the parent for everything inside windows.
      className={`select-text flex-1 ${
        noPadding ? "overflow-hidden" : "custom-scrollbar overflow-y-auto px-6 py-5"
      }`}
      style={{ color: "var(--color-text)", background: "var(--color-surface-solid)" }}
    >
      {children}
    </div>
  );
}
