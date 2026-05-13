import { useRef, type ComponentPropsWithoutRef } from "react";

import { COLOR_PALETTE, isWritableElement } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import {
  saveCaretPosition,
  restoreCaretPosition,
} from "../../hooks/useTextEditorFocus";

import { activeEyeDropperAtom } from "../EyeDropper";
import { PropertiesPopover } from "../PropertiesPopover";
import { useExcalidrawContainer, useStylesPanelMode } from "../App";

import { ColorInput } from "./ColorInput";
import { Picker } from "./Picker";
import PickerHeading from "./PickerHeading";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";

import type { AppState } from "../../types";

import type { ColorPickerType } from "./colorPickerUtils";

const noopUpdateData = () => {};

type PropertiesPopoverConfigurable = Partial<
  Pick<
    ComponentPropsWithoutRef<typeof PropertiesPopover>,
    | "desktopSide"
    | "desktopAlign"
    | "sideOffset"
    | "alignOffset"
    | "contentStyle"
    | "showArrow"
  >
>;

export type FullColorPickerPopoverProps = {
  color: string | null;
  onChange: (color: string) => void;
  label: string;
  type: ColorPickerType;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  onRequestClose: () => void;
  /** Forwarded to `PropertiesPopover` (positioning, stacking, etc.). */
  popoverProps?: PropertiesPopoverConfigurable;
};

/**
 * Same palette UI as the main styles-panel stroke/background popover
 * (`Picker` + hex input), for use outside `ColorPicker`'s `openPopup` flow.
 */
export const FullColorPickerPopover = ({
  color,
  onChange,
  label,
  type,
  elements,
  appState,
  onRequestClose,
  popoverProps,
}: FullColorPickerPopoverProps) => {
  const { container } = useExcalidrawContainer();
  const stylesPanelMode = useStylesPanelMode();
  const isCompactMode = stylesPanelMode !== "full";
  const isMobileMode = stylesPanelMode === "mobile";
  const [, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);
  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

  const colorPickerContentRef = useRef<HTMLDivElement>(null);
  const focusPickerContent = () => {
    colorPickerContentRef.current?.focus();
  };

  const colorInputJSX = (
    <div>
      <PickerHeading>{t("colorPicker.hexCode")}</PickerHeading>
      <ColorInput
        color={color || ""}
        label={label}
        onChange={onChange}
        colorPickerType={type}
        placeholder={t("colorPicker.color")}
      />
    </div>
  );

  return (
    <PropertiesPopover
      {...popoverProps}
      container={container}
      style={{ maxWidth: "13rem" }}
      preventAutoFocusOnTouch={!!appState.editingTextElement}
      onFocusOutside={(event) => {
        if (!isWritableElement(event.target)) {
          focusPickerContent();
        }
        event.preventDefault();
      }}
      onPointerDownOutside={(event) => {
        if (eyeDropperState) {
          event.preventDefault();
        }
      }}
      onClose={() => {
        setActiveColorPickerSection(null);
        if (appState.editingTextElement) {
          setTimeout(() => {
            const textEditor = document.querySelector(
              ".excalidraw-wysiwyg",
            ) as HTMLTextAreaElement;
            if (textEditor) {
              textEditor.focus();
            }
          }, 0);
        }
        onRequestClose();
      }}
    >
      <Picker
        ref={colorPickerContentRef}
        palette={COLOR_PALETTE}
        color={color}
        onChange={(changedColor) => {
          const savedSelection = appState.editingTextElement
            ? saveCaretPosition()
            : null;

          onChange(changedColor);

          if (appState.editingTextElement && savedSelection) {
            restoreCaretPosition(savedSelection);
          }
        }}
        onEyeDropperToggle={(force) => {
          setEyeDropperState((state) => {
            if (force) {
              state = state || {
                keepOpenOnAlt: true,
                onSelect: onChange,
                colorPickerType: type,
              };
              state.keepOpenOnAlt = true;
              return state;
            }

            return force === false || state
              ? null
              : {
                  keepOpenOnAlt: false,
                  onSelect: onChange,
                  colorPickerType: type,
                };
          });
        }}
        onEscape={() => {
          if (eyeDropperState) {
            setEyeDropperState(null);
          } else {
            onRequestClose();
          }
        }}
        type={type}
        elements={elements}
        updateData={noopUpdateData}
        showTitle={isCompactMode}
        showHotKey={!isMobileMode}
      >
        {colorInputJSX}
      </Picker>
    </PropertiesPopover>
  );
};
