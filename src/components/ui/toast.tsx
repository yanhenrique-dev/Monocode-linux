import { Toast as BaseToast } from "@base-ui/react/toast";
import type { ComponentProps } from "react";
import { LAYER } from "../../lib/layers";
import { cn } from "../../lib/utils";
import { GlassBackdrop } from "../../chrome/GlassBackdrop";

/**
 * Toast over the Base UI manager. ApprovalToasts stays declarative (notices
 * array, per-project prefs, no auto-dismiss); use this for transient
 * fire-and-forget toasts via `useToastManager()`.
 *
 * Mount once near the app root:
 *   <ToastProvider><ToastViewport />{app}</ToastProvider>
 */
export function ToastProvider(props: ComponentProps<typeof BaseToast.Provider>) {
  return <BaseToast.Provider timeout={5000} limit={3} {...props} />;
}

export function ToastViewport({
  className,
  ...props
}: ComponentProps<typeof BaseToast.Viewport>) {
  return (
    <BaseToast.Viewport
      {...props}
      style={{ zIndex: LAYER.toast }}
      className={cn(
        "pointer-events-none fixed right-3 top-3 flex w-[min(360px,calc(100vw-24px))] flex-col gap-2",
        className,
      )}
    />
  );
}

export function ToastRoot({
  className,
  ...props
}: ComponentProps<typeof BaseToast.Root>) {
  return (
    <BaseToast.Root
      {...props}
      className={cn(
        "pointer-events-auto relative isolate overflow-hidden rounded-xl border border-content/20 bg-content/10 shadow-xl",
        className,
      )}
    />
  );
}

export function ToastContent({
  className,
  ...props
}: ComponentProps<typeof BaseToast.Content>) {
  return (
    <>
      <GlassBackdrop className="bg-background-base/55" />
      <BaseToast.Content
        {...props}
        className={cn("relative z-[1] px-3.5 py-3", className)}
      />
    </>
  );
}

export const ToastTitle = BaseToast.Title;
export const ToastDescription = BaseToast.Description;
export const ToastClose = BaseToast.Close;
export const ToastAction = BaseToast.Action;
export const useToastManager = BaseToast.useToastManager;

/**
 * Default rendering of managed toasts: place inside the viewport.
 * Toasts carrying custom content use `data` + a `type` switch here later;
 * until then title + description cover transient notices.
 */
export function ToastList() {
  const { toasts } = BaseToast.useToastManager();
  return (
    <>
      {toasts.map((toast) => (
        <ToastRoot key={toast.id} toast={toast}>
          <ToastContent>
            <BaseToast.Title className="block text-[13px] font-semibold leading-snug text-content">
              {toast.title}
            </BaseToast.Title>
            {toast.description ? (
              <BaseToast.Description className="mt-0.5 block text-[12px] leading-relaxed text-content/70">
                {toast.description}
              </BaseToast.Description>
            ) : null}
          </ToastContent>
        </ToastRoot>
      ))}
    </>
  );
}
