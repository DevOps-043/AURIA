import React from "react";

/**
 * Pre-processes raw text that may have markdown markers (###, *, ---)
 * all in a single line, splitting them into proper lines first.
 */
function normalizeMarkdown(raw: string): string {
  let text = raw;

  // Insert line breaks before markdown markers that appear inline
  // #### before ### to avoid partial matches
  text = text.replace(/\s*####\s*/g, "\n#### ");
  text = text.replace(/\s*###\s*/g, "\n### ");
  // Bullets: " * " or " - " preceded by a period/text (not inside a word)
  text = text.replace(/([.!?:])(\s+)\*\s+/g, "$1\n* ");
  text = text.replace(/([.!?:])(\s+)-\s+/g, "$1\n- ");
  // Dividers
  text = text.replace(/\s*---\s*/g, "\n---\n");

  return text.trim();
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Also handle `code` backtick markers
    if (part.includes("`")) {
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((cp, j) => {
        if (cp.startsWith("`") && cp.endsWith("`")) {
          return (
            <code key={`${i}-${j}`} className="rounded bg-background/80 px-1.5 py-0.5 text-xs font-mono text-primary">
              {cp.slice(1, -1)}
            </code>
          );
        }
        return cp;
      });
    }
    return part;
  });
}

export function MarkdownContent({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const normalized = normalizeMarkdown(text);
  const lines = normalized.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (!trimmed) continue;

    if (trimmed === "---") {
      elements.push(<hr key={i} className="my-3 border-border/30" />);
      continue;
    }

    if (trimmed.startsWith("####")) {
      elements.push(
        <p key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wide text-foreground/90">
          {renderInline(trimmed.replace(/^#{4}\s*/, ""))}
        </p>,
      );
      continue;
    }

    if (trimmed.startsWith("###")) {
      elements.push(
        <p key={i} className="mt-4 mb-1 text-sm font-black text-foreground">
          {renderInline(trimmed.replace(/^#{3}\s*/, ""))}
        </p>,
      );
      continue;
    }

    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      elements.push(
        <div key={i} className="flex gap-2 pl-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
          <span className="text-sm leading-relaxed text-muted-foreground">
            {renderInline(trimmed.slice(2))}
          </span>
        </div>,
      );
      continue;
    }

    elements.push(
      <p key={i} className="text-sm leading-relaxed text-muted-foreground">
        {renderInline(trimmed)}
      </p>,
    );
  }

  return (
    <div
      className={className ?? "mt-2 space-y-1"}
      style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
    >
      {elements}
    </div>
  );
}
