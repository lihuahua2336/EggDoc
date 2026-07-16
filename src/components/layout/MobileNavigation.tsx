import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AuthStatus } from "@/components/auth/AuthStatus";
import { Button } from "@/components/ui/button";

type MobileNavigationProps = {
  items: Array<{ href: string; label: string }>;
};

export function MobileNavigation({ items }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      firstLinkRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function closeAndRestoreFocus() {
    setOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <>
      <Button
        aria-controls="mobile-navigation"
        aria-expanded={open}
        aria-label="打开导航菜单"
        className="md:hidden"
        onClick={() => setOpen(true)}
        ref={menuButtonRef}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Menu aria-hidden="true" className="h-4 w-4" />
      </Button>

      <dialog
        aria-label="移动导航"
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(22rem,calc(100vw-2rem))] max-w-none border-0 border-l border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40 md:hidden"
        id="mobile-navigation"
        onCancel={(event) => {
          event.preventDefault();
          closeAndRestoreFocus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeAndRestoreFocus();
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <div className="flex h-full min-w-0 flex-col" onClick={(event) => event.stopPropagation()}>
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
            <span className="text-sm font-semibold">导航</span>
            <Button
              aria-label="关闭导航菜单"
              onClick={closeAndRestoreFocus}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>

          <nav aria-label="移动端主导航" className="grid gap-1 p-4">
            {items.map((item, index) => (
              <a
                className="min-w-0 rounded-md px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={item.href}
                key={item.href}
                onClick={closeAndRestoreFocus}
                ref={index === 0 ? firstLinkRef : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-auto min-w-0 border-t border-border p-4">
            {open && <AuthStatus layout="drawer" onAction={closeAndRestoreFocus} />}
          </div>
        </div>
      </dialog>
    </>
  );
}
