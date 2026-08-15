import * as React from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@tds-nivaran/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tds-nivaran/ui/components/dialog";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
};

type ConfirmContextType = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmModalContext = React.createContext<ConfirmContextType | null>(null);

export function ConfirmModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConfirmOptions>({});
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      resolverRef.current = resolve;
    });
  }, []);

  function handleClose(result: boolean) {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }

  const {
    title = "Are you sure?",
    description = "This action cannot be undone.",
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "destructive",
  } = options;

  return (
    <ConfirmModalContext.Provider value={confirm}>
      {children}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleClose(false);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-destructive">
              {variant === "destructive" ? <AlertTriangleIcon className="size-5" /> : null}
              <DialogTitle>{title}</DialogTitle>
            </div>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={() => handleClose(true)}
            >
              {confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmModalContext.Provider>
  );
}

export function useConfirmModal() {
  const context = React.useContext(ConfirmModalContext);
  if (!context) {
    throw new Error("useConfirmModal must be used within a ConfirmModalProvider");
  }
  return context;
}
