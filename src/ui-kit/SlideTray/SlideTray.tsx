import * as DialogPrimitive from '@radix-ui/react-dialog';
import { forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/helpers/utils';
import { X } from '@/assets/icons';
import { Button } from '../Button';
import { Separator } from '../Separator';
import { useRef, useState } from 'react';
import { useGesture } from '@use-gesture/react';

interface SlideTrayProps {
  triggerComponent: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  className?: string;
  closeButtonVariant?: 'top-right' | 'bottom-center';
  height?: string;
  showBottomBorder?: boolean;
  reducedTopMargin?: boolean;
  status?: 'error' | 'warn' | 'good';
  onClose?: () => void;
}

export const SlideTray = forwardRef<unknown, SlideTrayProps>(
  (
    {
      triggerComponent,
      title,
      children,
      className,
      closeButtonVariant = 'bottom-center',
      height = '75%',
      showBottomBorder = false,
      reducedTopMargin = false,
      status = 'good',
      onClose,
    },
    ref,
  ) => {
    const trayRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const startY = useRef<number>(0);

    const [isDragging, setIsDragging] = useState(false);
    const [isMouseDown, setIsMouseDown] = useState(false);

    let titleColor = 'text-white';
    if (status === 'warn') {
      titleColor = 'text-warning';
    } else if (status === 'error') {
      titleColor = 'text-error';
    }

    const dismissThresholdPercentage = 0.3;
    const trayTransitionAnimation = 'transform 0.3s ease';

    const resetTrayPosition = () => {
      if (trayRef.current) {
        trayRef.current.style.transition = trayTransitionAnimation;
        trayRef.current.style.transform = 'translateY(0px)';
      }
    };

    const dismissTray = () => {
      if (trayRef.current) {
        trayRef.current.style.transition = trayTransitionAnimation;
        trayRef.current.style.transform = `translateY(${trayRef.current.clientHeight}px)`;

        setTimeout(() => {
          setOpen(false);
          onClose?.();
        }, 300);
      }
    };

    const calculateDismissThreshold = () => {
      if (trayRef.current) {
        const threshold = trayRef.current.clientHeight * dismissThresholdPercentage;

        return threshold;
      }
      return 0;
    };

    // Gesture handling for swipe to dismiss
    const bind = useGesture({
      onDrag: ({
        movement: [, my],
        memo = trayRef.current?.getBoundingClientRect().top,
        event,
      }) => {
        event.stopPropagation();

        if (isMouseDown) {
          setIsDragging(true);
        }

        if (trayRef.current) {
          trayRef.current.style.transform = `translateY(${Math.max(0, my)}px)`;
          trayRef.current.style.transition = '';
        }
        return memo;
      },
      onDragEnd: ({ movement: [, my] }) => {
        setIsDragging(false);

        if (trayRef.current) {
          const threshold = calculateDismissThreshold();
          if (my > threshold) {
            dismissTray();
          } else {
            resetTrayPosition();
          }
        }
      },
    });

    // Detect scrolling or clicking in the trigger component
    const handleMouseDown = (e: React.MouseEvent) => {
      startY.current = e.clientY;
      setIsMouseDown(true);
    };

    const handleMouseUp = (e: React.MouseEvent) => {
      const endY = e.clientY;
      const diff = Math.abs(startY.current - endY);

      // If there's minimal movement and no dragging
      if (diff < 5 && !isDragging) {
        setOpen(true);
      }

      setIsDragging(false);
      setIsMouseDown(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      const endY = e.clientY;
      const diff = Math.abs(startY.current - endY);

      if (isMouseDown && diff > 5) {
        setIsDragging(true);
      }
    };

    useImperativeHandle(ref, () => ({
      closeWithAnimation: dismissTray,
      isOpen: () => open,
    }));

    const handleOverlayClick = () => {
      dismissTray();
    };

    // TODO: darken slidetray
    return (
      <DialogPrimitive.Root
        open={open}
        onOpenChange={newOpen => {
          if (!newOpen) dismissTray();
          else setOpen(true);
        }}
      >
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          tabIndex={-1}
          role="presentation"
        >
          {triggerComponent}
        </div>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-50 bg-background-dialog-overlay"
            onClick={handleOverlayClick}
          />
          <DialogPrimitive.Content
            ref={trayRef}
            {...bind()}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-50 w-full mx-auto p-6 bg-background-dialog-bg rounded-t-2xl flex flex-col',
              'data-[state=open]:animate-slide-in-from-bottom data-[state=closed]:animate-slide-out-to-bottom',
              className,
            )}
            style={{ height }}
          >
            <div className="relative flex flex-col h-full">
              {title && (
                <>
                  <h2 className={`text-h5 font-bold line-clamp-1 ${titleColor} text-center mb-2`}>
                    {title}
                  </h2>
                  <Separator variant={reducedTopMargin ? 'bottom' : 'top'} />
                </>
              )}
              <div className="flex-1 overflow-y-auto">{children}</div>
              {closeButtonVariant === 'top-right' && (
                <DialogPrimitive.Close className="absolute right-4 top-4 focus:outline-none">
                  <X width={18} height={18} />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
              {closeButtonVariant === 'bottom-center' && (
                <>
                  <Separator variant="bottom" showBorder={showBottomBorder} />
                  <div className="flex justify-center mt-1">
                    <DialogPrimitive.Close asChild>
                      <Button className="w-[56%] py-3 rounded-full text-lg">Close</Button>
                    </DialogPrimitive.Close>
                  </div>
                </>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  },
);
