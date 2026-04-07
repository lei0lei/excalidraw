import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import DialogActionButton from "@excalidraw/excalidraw/components/DialogActionButton";
import { useState } from "react";

import "./TemplateLibraryDialog.scss";

import type {
  UmlClassTemplatePreset,
  UmlDiagramTemplatePreset,
} from "../templates";

type TemplateLibraryDialogProps = {
  onClose: () => void;
  onInsertUmlClass: (preset: UmlClassTemplatePreset) => void;
  onInsertUmlDiagram: (preset: UmlDiagramTemplatePreset) => void;
};

const UML_TEMPLATE_CARDS: Array<{
  preset: UmlClassTemplatePreset;
  title: string;
  description: string;
  titleText: string;
  stereotype?: string;
  attributes?: string;
  methods?: string;
}> = [
  {
    preset: "class",
    title: "Class",
    description: "Standard UML class with attributes and methods.",
    titleText: "ClassName",
    attributes: "name: string",
    methods: "method(): void",
  },
  {
    preset: "interface",
    title: "Interface",
    description: "Interface contract block for service or API definitions.",
    titleText: "IService",
    stereotype: "interface",
    methods: "execute(): Promise<void>",
  },
  {
    preset: "abstract-class",
    title: "Abstract class",
    description: "Base class template for shared state and behavior.",
    titleText: "BaseService",
    stereotype: "abstract",
    attributes: "repository: Repository",
    methods: "run(): void",
  },
  {
    preset: "enum",
    title: "Enum",
    description: "Enumeration template for fixed value sets.",
    titleText: "Status",
    stereotype: "enum",
    attributes: "Pending\nRunning\nDone",
  },
];

export const TemplateLibraryDialog = ({
  onClose,
  onInsertUmlClass,
  onInsertUmlDiagram,
}: TemplateLibraryDialogProps) => {
  const [selectedCategory, setSelectedCategory] = useState<"uml">("uml");

  return (
    <Dialog
      size="regular"
      className="TemplateLibraryDialog__dialog"
      title="Template library"
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
            UML
          </button>
        </div>

        <div className="TemplateLibraryDialog__content">
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
                      {card.stereotype && (
                        <div className="TemplateLibraryDialog__umlStereotype">
                          {`<<${card.stereotype}>>`}
                        </div>
                      )}
                      <div>{card.titleText}</div>
                    </div>
                    {card.attributes !== undefined && (
                      <>
                        <div className="TemplateLibraryDialog__umlDivider" />
                        <div className="TemplateLibraryDialog__umlBody">
                          {card.attributes}
                        </div>
                      </>
                    )}
                    {card.methods !== undefined && (
                      <>
                        <div className="TemplateLibraryDialog__umlDivider" />
                        <div className="TemplateLibraryDialog__umlBody">
                          {card.methods}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="TemplateLibraryDialog__cardTitle">
                  {card.title}
                </div>
                <div className="TemplateLibraryDialog__cardDescription">
                  {card.description}
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
              <div className="TemplateLibraryDialog__cardTitle">Actor</div>
              <div className="TemplateLibraryDialog__cardDescription">
                Stick figure actor for use case diagrams.
              </div>
            </button>

            <button
              type="button"
              className="TemplateLibraryDialog__card"
              onClick={() => onInsertUmlDiagram("use-case")}
            >
              <div className="TemplateLibraryDialog__cardPreview">
                <div className="TemplateLibraryDialog__umlUseCasePreview">
                  Use Case
                </div>
              </div>
              <div className="TemplateLibraryDialog__cardTitle">Use case</div>
              <div className="TemplateLibraryDialog__cardDescription">
                Ellipse template for use case diagrams.
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
                    Package
                  </div>
                </div>
              </div>
              <div className="TemplateLibraryDialog__cardTitle">Package</div>
              <div className="TemplateLibraryDialog__cardDescription">
                Package block for grouping classes or components.
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
                  <span>Note</span>
                </div>
              </div>
              <div className="TemplateLibraryDialog__cardTitle">Note</div>
              <div className="TemplateLibraryDialog__cardDescription">
                UML note block for annotations.
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
                  <span>Component</span>
                </div>
              </div>
              <div className="TemplateLibraryDialog__cardTitle">Component</div>
              <div className="TemplateLibraryDialog__cardDescription">
                Component block for higher-level architecture diagrams.
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
                Association
              </div>
              <div className="TemplateLibraryDialog__cardDescription">
                Plain relationship line between UML elements.
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
                Inheritance
              </div>
              <div className="TemplateLibraryDialog__cardDescription">
                Generalization arrow with hollow triangle head.
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
                Aggregation
              </div>
              <div className="TemplateLibraryDialog__cardDescription">
                Shared ownership line with hollow diamond.
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
                Composition
              </div>
              <div className="TemplateLibraryDialog__cardDescription">
                Strong ownership line with filled diamond.
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
              <div className="TemplateLibraryDialog__cardTitle">Dependency</div>
              <div className="TemplateLibraryDialog__cardDescription">
                Dashed dependency arrow for loose coupling.
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
                    Participant
                  </div>
                  <div className="TemplateLibraryDialog__umlSequenceLine" />
                </div>
              </div>
              <div className="TemplateLibraryDialog__cardTitle">
                Sequence lifeline
              </div>
              <div className="TemplateLibraryDialog__cardDescription">
                Participant header and dashed lifeline for sequence diagrams.
              </div>
            </button>
          </div>

          <div className="TemplateLibraryDialog__actions">
            <DialogActionButton label="Close" onClick={onClose} />
          </div>
        </div>
      </div>
    </Dialog>
  );
};
