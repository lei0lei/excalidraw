import { PlusIcon, TrashIcon } from "@excalidraw/excalidraw/components/icons";
import { randomId } from "@excalidraw/common";
import { useEffect, useMemo, useState } from "react";

import "./UmlClassSidebar.scss";

import type {
  UmlClassTemplateData,
  UmlClassTemplateMember,
} from "../templates";

type UmlClassSidebarProps = {
  data: UmlClassTemplateData | null;
  onChange: (data: UmlClassTemplateData) => void;
};

const cloneMembers = (members: UmlClassTemplateMember[]) =>
  members.map((member) => ({
    id: member.id,
    text: member.text,
  }));

const areMembersEqual = (
  left: UmlClassTemplateMember[],
  right: UmlClassTemplateMember[],
) =>
  left.length === right.length &&
  left.every(
    (member, index) =>
      member.id === right[index]?.id && member.text === right[index]?.text,
  );

const areDraftsEqual = (
  left: UmlClassTemplateData | null,
  right: UmlClassTemplateData | null,
) => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.name === right.name &&
    (left.stereotype || "") === (right.stereotype || "") &&
    areMembersEqual(left.attributes, right.attributes) &&
    areMembersEqual(left.methods, right.methods)
  );
};

const MemberListSection = ({
  title,
  items,
  placeholder,
  onAdd,
  onChange,
  onRemove,
}: {
  title: string;
  items: UmlClassTemplateMember[];
  placeholder: string;
  onAdd: () => void;
  onChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) => {
  return (
    <div className="UmlClassSidebar__field">
      <div className="UmlClassSidebar__sectionHeader">
        <span className="UmlClassSidebar__label">{title}</span>
        <button
          type="button"
          className="UmlClassSidebar__addButton"
          onClick={onAdd}
          aria-label={`Add ${title}`}
          title={`Add ${title}`}
        >
          {PlusIcon}
        </button>
      </div>

      <div className="UmlClassSidebar__list">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="UmlClassSidebar__row">
              <input
                className="UmlClassSidebar__input UmlClassSidebar__input--row"
                value={item.text}
                onChange={(event) => onChange(item.id, event.target.value)}
                placeholder={placeholder}
              />
              <button
                type="button"
                className="UmlClassSidebar__iconButton"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${title}`}
                title={`Remove ${title}`}
              >
                {TrashIcon}
              </button>
            </div>
          ))
        ) : (
          <div className="UmlClassSidebar__empty">
            No {title.toLowerCase()} yet
          </div>
        )}
      </div>
    </div>
  );
};

export const UmlClassSidebar = ({ data, onChange }: UmlClassSidebarProps) => {
  const [name, setName] = useState(data?.name || "");
  const [stereotype, setStereotype] = useState(data?.stereotype || "");
  const [attributes, setAttributes] = useState<UmlClassTemplateMember[]>(
    cloneMembers(data?.attributes || []),
  );
  const [methods, setMethods] = useState<UmlClassTemplateMember[]>(
    cloneMembers(data?.methods || []),
  );

  useEffect(() => {
    setName(data?.name || "");
    setStereotype(data?.stereotype || "");
    setAttributes(cloneMembers(data?.attributes || []));
    setMethods(cloneMembers(data?.methods || []));
  }, [data]);

  const draft = useMemo<UmlClassTemplateData | null>(() => {
    if (!data) {
      return null;
    }

    return {
      ...data,
      name: name.trim() || "ClassName",
      stereotype: stereotype.trim(),
      attributes: attributes.filter((item) => item.text.trim()),
      methods: methods.filter((item) => item.text.trim()),
    };
  }, [attributes, data, methods, name, stereotype]);

  useEffect(() => {
    if (!draft || !data || areDraftsEqual(draft, data)) {
      return;
    }

    onChange(draft);
  }, [data, draft, onChange]);

  const updateMember = (
    items: UmlClassTemplateMember[],
    id: string,
    value: string,
  ) => items.map((item) => (item.id === id ? { ...item, text: value } : item));

  return (
    <div className="UmlClassSidebar">
      <div className="UmlClassSidebar__content">
        <label className="UmlClassSidebar__field">
          <span className="UmlClassSidebar__label">Class name</span>
          <input
            className="UmlClassSidebar__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ClassName"
          />
        </label>

        <label className="UmlClassSidebar__field">
          <span className="UmlClassSidebar__label">Stereotype</span>
          <input
            className="UmlClassSidebar__input"
            value={stereotype}
            onChange={(event) => setStereotype(event.target.value)}
            placeholder="interface / abstract / enum"
          />
        </label>

        <MemberListSection
          title="Attributes"
          items={attributes}
          placeholder="name: string"
          onAdd={() =>
            setAttributes((current) => [
              ...current,
              { id: randomId(), text: "" },
            ])
          }
          onChange={(id, value) =>
            setAttributes((current) => updateMember(current, id, value))
          }
          onRemove={(id) =>
            setAttributes((current) => current.filter((item) => item.id !== id))
          }
        />

        <MemberListSection
          title="Methods"
          items={methods}
          placeholder="login(): void"
          onAdd={() =>
            setMethods((current) => [...current, { id: randomId(), text: "" }])
          }
          onChange={(id, value) =>
            setMethods((current) => updateMember(current, id, value))
          }
          onRemove={(id) =>
            setMethods((current) => current.filter((item) => item.id !== id))
          }
        />
      </div>
    </div>
  );
};
