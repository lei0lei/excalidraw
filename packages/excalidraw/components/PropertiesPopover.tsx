import { Popover } from "radix-ui";
import clsx from "clsx";
import React, { type CSSProperties, type ReactNode } from "react";

import { isInteractive } from "@excalidraw/common";

import { useEditorInterface } from "./App";
import { Island } from "./Island";

interface PropertiesPopoverProps {
  className?: string;
  container: HTMLDivElement | null;
  children: ReactNode;
  style?: object;
  onClose: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
  onFocusOutside?: Popover.PopoverContentProps["onFocusOutside"];
  onPointerDownOutside?: Popover.PopoverContentProps["onPointerDownOutside"];
  preventAutoFocusOnTouch?: boolean;
  /** Desktop / landscape: override default `side="right"`. Mobile portrait still uses `bottom`. */
  desktopSide?: Popover.PopoverContentProps["side"];
  /** Desktop / landscape: override default `align="start"`. */
  desktopAlign?: Popover.PopoverContentProps["align"];
  /** Override Radix `sideOffset` (default 20). */
  sideOffset?: number;
  /** Override Radix `alignOffset` (default -16 on desktop). */
  alignOffset?: number;
  showArrow?: boolean;
  /** Merged into `Popover.Content` style (e.g. raise z-index above the library sidebar). */
  contentStyle?: CSSProperties;
}

export const PropertiesPopover = React.forwardRef<
  HTMLDivElement,
  PropertiesPopoverProps
>(
  (
    {
      className,
      container,
      children,
      style,
      onClose,
      onKeyDown,
      onFocusOutside,
      onPointerLeave,
      onPointerDownOutside,
      preventAutoFocusOnTouch = false,
      desktopSide,
      desktopAlign,
      sideOffset: sideOffsetProp,
      alignOffset: alignOffsetProp,
      showArrow = true,
      contentStyle,
    },
    ref,
  ) => {
    const editorInterface = useEditorInterface();
    const isMobilePortrait =
      editorInterface.formFactor === "phone" && !editorInterface.isLandscape;

    const side = isMobilePortrait
      ? "bottom"
      : desktopSide ?? "right";
    const align = isMobilePortrait
      ? "center"
      : desktopAlign ?? "start";
    const sideOffset = sideOffsetProp ?? 20;
    const alignOffset =
      alignOffsetProp ?? (isMobilePortrait ? 0 : -16);

    return (
      <Popover.Portal container={container}>
        <Popover.Content
          ref={ref}
          className={clsx("focus-visible-none", className)}
          data-prevent-outside-click
          side={side}
          align={align}
          alignOffset={alignOffset}
          sideOffset={sideOffset}
          collisionBoundary={container ?? undefined}
          style={{
            zIndex: "var(--zIndex-ui-styles-popup)",
            marginLeft:
              editorInterface.formFactor === "phone" ? "0.5rem" : undefined,
            ...contentStyle,
          }}
          onPointerLeave={onPointerLeave}
          onKeyDown={onKeyDown}
          onFocusOutside={onFocusOutside}
          onPointerDownOutside={onPointerDownOutside}
          onOpenAutoFocus={(e) => {
            // prevent auto-focus on touch devices to avoid keyboard popup
            if (preventAutoFocusOnTouch && editorInterface.isTouchScreen) {
              e.preventDefault();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.stopPropagation();
            // prevents focusing the trigger
            e.preventDefault();

            // return focus to excalidraw container unless
            // user focuses an interactive element, such as a button, or
            // enters the text editor by clicking on canvas with the text tool
            if (container && !isInteractive(document.activeElement)) {
              container.focus();
            }

            onClose();
          }}
        >
          <Island padding={3} style={style}>
            {children}
          </Island>
          {showArrow && (
            <Popover.Arrow
              width={20}
              height={10}
              style={{
                fill: "var(--popup-bg-color)",
                filter: "drop-shadow(rgba(0, 0, 0, 0.05) 0px 3px 2px)",
              }}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    );
  },
);
