import { useEffect, useMemo, useState } from "react";

import "./UmlDiagramSidebar.scss";

import type { UmlDiagramTemplateData } from "../templates/umlDiagram";

type UmlDiagramSidebarProps = {
  data: UmlDiagramTemplateData | null;
  onChange: (data: UmlDiagramTemplateData) => void;
};

const getFieldLabels = (preset: UmlDiagramTemplateData["preset"]) => {
  switch (preset) {
    case "use-case":
      return { label: "Use case name", placeholder: "Use Case" };
    case "package":
      return { label: "Package name", placeholder: "PackageName" };
    case "component":
      return { label: "Component name", placeholder: "Component" };
    case "note":
      return { label: "Title", placeholder: "Note" };
    case "sequence-lifeline":
      return { label: "Participant", placeholder: "Participant" };
    case "actor":
      return { label: "Actor name", placeholder: "Actor" };
    case "association":
    case "inheritance":
    case "aggregation":
    case "composition":
    case "dependency":
      return { label: "Label", placeholder: "relationship" };
    default:
      return { label: "Name", placeholder: "Template" };
  }
};

const areDraftsEqual = (
  left: UmlDiagramTemplateData | null,
  right: UmlDiagramTemplateData | null,
) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.preset === right.preset &&
    left.label === right.label &&
    (left.body || "") === (right.body || "")
  );
};

export const UmlDiagramSidebar = ({
  data,
  onChange,
}: UmlDiagramSidebarProps) => {
  const [label, setLabel] = useState(data?.label || "");
  const [body, setBody] = useState(data?.body || "");

  useEffect(() => {
    setLabel(data?.label || "");
    setBody(data?.body || "");
  }, [data]);

  const labels = useMemo(
    () => getFieldLabels(data?.preset || "note"),
    [data?.preset],
  );

  const draft = useMemo<UmlDiagramTemplateData | null>(() => {
    if (!data) {
      return null;
    }

    return {
      ...data,
      label,
      body,
    };
  }, [body, data, label]);

  useEffect(() => {
    if (!draft || !data || areDraftsEqual(draft, data)) {
      return;
    }

    onChange(draft);
  }, [data, draft, onChange]);

  if (!data) {
    return null;
  }

  return (
    <div className="UmlDiagramSidebar">
      <div className="UmlDiagramSidebar__content">
        <div className="UmlDiagramSidebar__type">{data.preset}</div>

        <label className="UmlDiagramSidebar__field">
          <span className="UmlDiagramSidebar__label">{labels.label}</span>
          <input
            className="UmlDiagramSidebar__input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={labels.placeholder}
          />
        </label>

        {data.preset === "note" && (
          <label className="UmlDiagramSidebar__field">
            <span className="UmlDiagramSidebar__label">Body</span>
            <textarea
              className="UmlDiagramSidebar__input UmlDiagramSidebar__textarea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Description"
              rows={6}
            />
          </label>
        )}
      </div>
    </div>
  );
};
