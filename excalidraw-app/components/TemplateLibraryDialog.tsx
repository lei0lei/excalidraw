import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";
import { type TranslationKeys, t } from "@excalidraw/excalidraw/i18n";
import { useState } from "react";

import "./TemplateLibraryDialog.scss";

import type {
  ChartGraphicPreset,
  MindMapTemplatePreset,
  UmlClassTemplatePreset,
  UmlDiagramTemplatePreset,
} from "../templates";

type TemplateCategory = "uml" | "chart" | "mindmap";

type TemplateLibraryDialogProps = {
  onClose: () => void;
  onInsertUmlClass: (preset: UmlClassTemplatePreset) => void;
  onInsertUmlDiagram: (preset: UmlDiagramTemplatePreset) => void;
  onInsertChartGraphic: (preset: ChartGraphicPreset) => void;
  onInsertMindMap: (preset: MindMapTemplatePreset) => void;
};

const CHART_TEMPLATE_CARDS: Array<{
  preset: ChartGraphicPreset;
  titleKey: TranslationKeys;
  descriptionKey: TranslationKeys;
}> = [
  {
    preset: "bar-chart",
    titleKey: "toolBar.templateLibraryDialog.chartBarTitle",
    descriptionKey: "toolBar.templateLibraryDialog.chartBarDesc",
  },
  {
    preset: "line-chart",
    titleKey: "toolBar.templateLibraryDialog.chartLineTitle",
    descriptionKey: "toolBar.templateLibraryDialog.chartLineDesc",
  },
  {
    preset: "pie-chart",
    titleKey: "toolBar.templateLibraryDialog.chartPieTitle",
    descriptionKey: "toolBar.templateLibraryDialog.chartPieDesc",
  },
];

type UmlClassCardDef = {
  preset: UmlClassTemplatePreset;
  titleKey: TranslationKeys;
  descriptionKey: TranslationKeys;
  previewNameKey: TranslationKeys;
  stereotypeKey?: TranslationKeys;
  previewAttrKey?: TranslationKeys;
  previewMethodsKey?: TranslationKeys;
};

const UML_TEMPLATE_CARDS: UmlClassCardDef[] = [
  {
    preset: "class",
    titleKey: "toolBar.templateLibraryDialog.umlClassClassTitle",
    descriptionKey: "toolBar.templateLibraryDialog.umlClassClassDesc",
    previewNameKey: "toolBar.templateLibraryDialog.umlClassClassPreviewName",
    previewAttrKey: "toolBar.templateLibraryDialog.umlClassClassPreviewAttr",
    previewMethodsKey:
      "toolBar.templateLibraryDialog.umlClassClassPreviewMethods",
  },
  {
    preset: "interface",
    titleKey: "toolBar.templateLibraryDialog.umlClassInterfaceTitle",
    descriptionKey: "toolBar.templateLibraryDialog.umlClassInterfaceDesc",
    previewNameKey:
      "toolBar.templateLibraryDialog.umlClassInterfacePreviewName",
    stereotypeKey: "toolBar.templateLibraryDialog.umlClassInterfaceStereotype",
    previewMethodsKey:
      "toolBar.templateLibraryDialog.umlClassInterfacePreviewMethods",
  },
  {
    preset: "abstract-class",
    titleKey: "toolBar.templateLibraryDialog.umlClassAbstractTitle",
    descriptionKey: "toolBar.templateLibraryDialog.umlClassAbstractDesc",
    previewNameKey: "toolBar.templateLibraryDialog.umlClassAbstractPreviewName",
    stereotypeKey: "toolBar.templateLibraryDialog.umlClassAbstractStereotype",
    previewAttrKey: "toolBar.templateLibraryDialog.umlClassAbstractPreviewAttr",
    previewMethodsKey:
      "toolBar.templateLibraryDialog.umlClassAbstractPreviewMethods",
  },
  {
    preset: "enum",
    titleKey: "toolBar.templateLibraryDialog.umlClassEnumTitle",
    descriptionKey: "toolBar.templateLibraryDialog.umlClassEnumDesc",
    previewNameKey: "toolBar.templateLibraryDialog.umlClassEnumPreviewName",
    stereotypeKey: "toolBar.templateLibraryDialog.umlClassEnumStereotype",
    previewAttrKey: "toolBar.templateLibraryDialog.umlClassEnumPreviewAttr",
  },
];

const MIND_MAP_TEMPLATE_CARDS: Array<{
  preset: MindMapTemplatePreset;
  titleKey: TranslationKeys;
  descriptionKey: TranslationKeys;
}> = [
  {
    preset: "radial",
    titleKey: "toolBar.templateLibraryDialog.mindRadialTitle",
    descriptionKey: "toolBar.templateLibraryDialog.mindRadialDesc",
  },
  {
    preset: "right-branches",
    titleKey: "toolBar.templateLibraryDialog.mindRightBranchesTitle",
    descriptionKey: "toolBar.templateLibraryDialog.mindRightBranchesDesc",
  },
  {
    preset: "top-down-tree",
    titleKey: "toolBar.templateLibraryDialog.mindTopDownTreeTitle",
    descriptionKey: "toolBar.templateLibraryDialog.mindTopDownTreeDesc",
  },
  {
    preset: "outline-spine",
    titleKey: "toolBar.templateLibraryDialog.mindOutlineSpineTitle",
    descriptionKey: "toolBar.templateLibraryDialog.mindOutlineSpineDesc",
  },
];

export const TemplateLibraryDialog = ({
  onClose,
  onInsertUmlClass,
  onInsertUmlDiagram,
  onInsertChartGraphic,
  onInsertMindMap,
}: TemplateLibraryDialogProps) => {
  const [selectedCategory, setSelectedCategory] =
    useState<TemplateCategory>("uml");

  return (
    <Dialog
      size="regular"
      className="TemplateLibraryDialog__dialog"
      title={t("toolBar.templateLibrary")}
      onCloseRequest={onClose}
      autofocus={false}
      closeOnClickOutside={true}
    >
      <div className="TemplateLibraryDialog">
        <div className="TemplateLibraryDialog__sidebar">
          <button
            type="button"
            className="TemplateLibraryDialog__category"
            data-active={selectedCategory === "uml"}
            onClick={() => setSelectedCategory("uml")}
          >
            {t("toolBar.templateLibraryDialog.catUml")}
          </button>
          <button
            type="button"
            className="TemplateLibraryDialog__category"
            data-active={selectedCategory === "chart"}
            onClick={() => setSelectedCategory("chart")}
          >
            {t("toolBar.templateLibraryDialog.catCharts")}
          </button>
          <button
            type="button"
            className="TemplateLibraryDialog__category"
            data-active={selectedCategory === "mindmap"}
            onClick={() => setSelectedCategory("mindmap")}
          >
            {t("toolBar.templateLibraryDialog.catMindMaps")}
          </button>
        </div>

        <div className="TemplateLibraryDialog__content">
          {selectedCategory === "uml" ? (
            <div className="TemplateLibraryDialog__grid">
              {UML_TEMPLATE_CARDS.map((card) => (
                <button
                  key={card.preset}
                  type="button"
                  className="TemplateLibraryDialog__card"
                  onClick={() => onInsertUmlClass(card.preset)}
                >
                  <div className="TemplateLibraryDialog__cardPreview">
                    <div className="TemplateLibraryDialog__umlBox">
                      <div className="TemplateLibraryDialog__umlTitle">
                        {card.stereotypeKey && (
                          <div className="TemplateLibraryDialog__umlStereotype">
                            {`<<${t(card.stereotypeKey)}>>`}
                          </div>
                        )}
                        <div>{t(card.previewNameKey)}</div>
                      </div>
                      {card.previewAttrKey !== undefined && (
                        <>
                          <div className="TemplateLibraryDialog__umlDivider" />
                          <div className="TemplateLibraryDialog__umlBody">
                            {t(card.previewAttrKey)}
                          </div>
                        </>
                      )}
                      {card.previewMethodsKey !== undefined && (
                        <>
                          <div className="TemplateLibraryDialog__umlDivider" />
                          <div className="TemplateLibraryDialog__umlBody">
                            {t(card.previewMethodsKey)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="TemplateLibraryDialog__cardTitle">
                    {t(card.titleKey)}
                  </div>
                  <div className="TemplateLibraryDialog__cardDescription">
                    {t(card.descriptionKey)}
                  </div>
                </button>
              ))}
              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("actor")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlActorPreview">
                    <div className="TemplateLibraryDialog__umlActorHead" />
                    <div className="TemplateLibraryDialog__umlActorBody" />
                    <div className="TemplateLibraryDialog__umlActorArms" />
                    <div className="TemplateLibraryDialog__umlActorLegLeft" />
                    <div className="TemplateLibraryDialog__umlActorLegRight" />
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t("toolBar.templateLibraryDialog.umlDiagramActorTitle")}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramActorDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("use-case")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlUseCasePreview">
                    {t(
                      "toolBar.templateLibraryDialog.umlDiagramUseCasePreview",
                    )}
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t("toolBar.templateLibraryDialog.umlDiagramUseCaseTitle")}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramUseCaseDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("package")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlPackagePreview">
                    <div className="TemplateLibraryDialog__umlPackageTab" />
                    <div className="TemplateLibraryDialog__umlPackageBody">
                      {t(
                        "toolBar.templateLibraryDialog.umlDiagramPackagePreview",
                      )}
                    </div>
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t("toolBar.templateLibraryDialog.umlDiagramPackageTitle")}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramPackageDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("note")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlNotePreview">
                    <div className="TemplateLibraryDialog__umlNoteFold" />
                    <span>
                      {t("toolBar.templateLibraryDialog.umlDiagramNotePreview")}
                    </span>
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t("toolBar.templateLibraryDialog.umlDiagramNoteTitle")}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramNoteDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("component")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlComponentPreview">
                    <div className="TemplateLibraryDialog__umlComponentPort TemplateLibraryDialog__umlComponentPort--top" />
                    <div className="TemplateLibraryDialog__umlComponentPort TemplateLibraryDialog__umlComponentPort--bottom" />
                    <span>
                      {t(
                        "toolBar.templateLibraryDialog.umlDiagramComponentPreview",
                      )}
                    </span>
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t("toolBar.templateLibraryDialog.umlDiagramComponentTitle")}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramComponentDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("association")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlRelationPreview">
                    <div className="TemplateLibraryDialog__umlRelationLine" />
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t(
                    "toolBar.templateLibraryDialog.umlDiagramAssociationTitle",
                  )}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramAssociationDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("inheritance")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlRelationPreview">
                    <div className="TemplateLibraryDialog__umlRelationLine TemplateLibraryDialog__umlRelationLine--inheritance" />
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t(
                    "toolBar.templateLibraryDialog.umlDiagramInheritanceTitle",
                  )}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramInheritanceDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("aggregation")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlRelationPreview">
                    <div className="TemplateLibraryDialog__umlRelationLine TemplateLibraryDialog__umlRelationLine--aggregation" />
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t(
                    "toolBar.templateLibraryDialog.umlDiagramAggregationTitle",
                  )}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramAggregationDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("composition")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlRelationPreview">
                    <div className="TemplateLibraryDialog__umlRelationLine TemplateLibraryDialog__umlRelationLine--composition" />
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t(
                    "toolBar.templateLibraryDialog.umlDiagramCompositionTitle",
                  )}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramCompositionDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("dependency")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlRelationPreview">
                    <div className="TemplateLibraryDialog__umlRelationLine TemplateLibraryDialog__umlRelationLine--dependency" />
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t("toolBar.templateLibraryDialog.umlDiagramDependencyTitle")}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramDependencyDesc")}
                </div>
              </button>

              <button
                type="button"
                className="TemplateLibraryDialog__card"
                onClick={() => onInsertUmlDiagram("sequence-lifeline")}
              >
                <div className="TemplateLibraryDialog__cardPreview">
                  <div className="TemplateLibraryDialog__umlSequencePreview">
                    <div className="TemplateLibraryDialog__umlSequenceHeader">
                      {t(
                        "toolBar.templateLibraryDialog.umlDiagramSequenceParticipant",
                      )}
                    </div>
                    <div className="TemplateLibraryDialog__umlSequenceLine" />
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {t("toolBar.templateLibraryDialog.umlDiagramSequenceTitle")}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {t("toolBar.templateLibraryDialog.umlDiagramSequenceDesc")}
                </div>
              </button>
            </div>
          ) : selectedCategory === "chart" ? (
            <div className="TemplateLibraryDialog__grid">
              {CHART_TEMPLATE_CARDS.map((card) => (
                <button
                  key={card.preset}
                  type="button"
                  className="TemplateLibraryDialog__card"
                  onClick={() => onInsertChartGraphic(card.preset)}
                >
                  <div className="TemplateLibraryDialog__cardPreview">
                    <div
                      className={`TemplateLibraryDialog__chartThumb TemplateLibraryDialog__chartThumb--${card.preset}`}
                    />
                  </div>
                  <div className="TemplateLibraryDialog__cardTitle">
                    {t(card.titleKey)}
                  </div>
                  <div className="TemplateLibraryDialog__cardDescription">
                    {t(card.descriptionKey)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="TemplateLibraryDialog__grid">
              {MIND_MAP_TEMPLATE_CARDS.map((card) => (
                <button
                  key={card.preset}
                  type="button"
                  className="TemplateLibraryDialog__card"
                  onClick={() => onInsertMindMap(card.preset)}
                >
                  <div className="TemplateLibraryDialog__cardPreview">
                    <div
                      className={`TemplateLibraryDialog__mindmapThumb TemplateLibraryDialog__mindmapThumb--${card.preset}`}
                    />
                  </div>
                  <div className="TemplateLibraryDialog__cardTitle">
                    {t(card.titleKey)}
                  </div>
                  <div className="TemplateLibraryDialog__cardDescription">
                    {t(card.descriptionKey)}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="TemplateLibraryDialog__actions">
            <DialogActionButton label={t("buttons.close")} onClick={onClose} />
          </div>
        </div>
      </div>
    </Dialog>
  );
};
