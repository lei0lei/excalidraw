import { codeIcon } from "@excalidraw/excalidraw/components/icons";

import type { ExcalidrawCustomToolbarExtraItem } from "@excalidraw/excalidraw/types";

const mathFormulaToolIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 7l4 5-4 5M12 7h7M12 12h7M12 17h7"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const templateLibraryToolIcon = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5.25 5.25h13.5v13.5H5.25zM8.75 5.25v13.5M8.75 10.5h10M8.75 15.25h10"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EXCALIDRAW_APP_CUSTOM_TOOLBAR_ITEMS: readonly ExcalidrawCustomToolbarExtraItem[] =
  [
    {
      customType: "math-formula",
      titleI18nKey: "toolBar.mathFormula",
      icon: mathFormulaToolIcon,
      testId: "toolbar-math-formula",
      shortcut: "Shift+M",
    },
    {
      customType: "code-block",
      titleI18nKey: "toolBar.codeBlock",
      icon: codeIcon,
      testId: "toolbar-code-block",
    },
    {
      customType: "template-library",
      titleI18nKey: "toolBar.templateLibrary",
      icon: templateLibraryToolIcon,
      testId: "toolbar-template-library",
    },
  ];
