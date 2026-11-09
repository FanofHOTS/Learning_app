import type { JSONContent } from "@tiptap/core";

type DocxModule = typeof import("docx");

function getNodeText(node: JSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }
  if (node.type === "hardBreak") {
    return "\n";
  }
  return (node.content ?? []).map(getNodeText).join("");
}

function toPlainText(document: JSONContent): string {
  const lines: string[] = [];

  function visit(node: JSONContent, listPrefix = ""): void {
    if (node.type === "doc") {
      for (const child of node.content ?? []) visit(child);
      return;
    }

    if (node.type === "bulletList" || node.type === "orderedList") {
      const items = node.content ?? [];
      items.forEach((item, index) => {
        const prefix =
          node.type === "bulletList" ? "- " : `${index + 1}. `;
        for (const child of item.content ?? []) visit(child, `${listPrefix}${prefix}`);
      });
      return;
    }

    if (node.type === "listItem") {
      for (const child of node.content ?? []) visit(child, listPrefix);
      return;
    }

    if (node.type === "horizontalRule") {
      lines.push("—");
      return;
    }

    if (node.type === "blockquote") {
      for (const child of node.content ?? []) {
        const text = getNodeText(child);
        if (text.trim()) lines.push(`${listPrefix}> ${text}`);
      }
      return;
    }

    if (node.type === "paragraph" || node.type === "heading") {
      const text = getNodeText(node).trim();
      if (!text) {
        lines.push("");
        return;
      }
      if (node.type === "heading") {
        const level = Math.min(Math.max(node.attrs?.level ?? 1, 1), 6);
        lines.push(`${"#".repeat(level)} ${listPrefix}${text}`);
      } else {
        lines.push(`${listPrefix}${text}`);
      }
      return;
    }

    for (const child of node.content ?? []) visit(child, listPrefix);
  }

  visit(document);
  return lines.join("\r\n").trim();
}

function toFilename(title: string, extension: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${slug || "bai-giang"}.${extension}`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function loadDocxModule(): Promise<DocxModule> {
  return import("docx");
}

function buildDocxParagraphs(
  docx: DocxModule,
  nodes: JSONContent[],
  listLevel = 0,
): InstanceType<DocxModule["Paragraph"]>[] {
  const paragraphs: InstanceType<DocxModule["Paragraph"]>[] = [];

  const toRuns = (
    node: JSONContent,
    inheritedMarks: JSONContent["marks"] = [],
    isQuote = false,
  ): InstanceType<DocxModule["TextRun"]>[] => {
    if (node.type === "text") {
      const marks = [...inheritedMarks, ...(node.marks ?? [])];
      const textStyle = marks.find((mark) => mark.type === "textStyle");
      const textColor =
        typeof textStyle?.attrs?.color === "string"
          ? textStyle.attrs.color.replace("#", "")
          : undefined;
      const fontSize = Number.parseFloat(
        typeof textStyle?.attrs?.fontSize === "string"
          ? textStyle.attrs.fontSize
          : "",
      );
      const highlightColor = marks
        .find((mark) => mark.type === "highlight")
        ?.attrs?.color;
      const options = {
        text: node.text ?? "",
        bold: marks.some((mark) => mark.type === "bold"),
        italics: isQuote || marks.some((mark) => mark.type === "italic"),
        strike: marks.some((mark) => mark.type === "strike"),
        underline: marks.some((mark) => mark.type === "underline")
          ? { type: docx.UnderlineType.SINGLE }
          : undefined,
        font: "Arial",
        color: isQuote ? "475569" : textColor,
        size: Number.isFinite(fontSize) ? Math.round(fontSize * 2) : undefined,
        shading:
          typeof highlightColor === "string"
            ? { fill: highlightColor.replace("#", "").toUpperCase(), color: "auto" }
            : undefined,
      };
      return [new docx.TextRun(options)];
    }
    if (node.type === "hardBreak") {
      return [new docx.TextRun({ text: "", break: 1 })];
    }
    return (node.content ?? []).flatMap((child) =>
      toRuns(child, inheritedMarks, isQuote),
    );
  };

  const toAlignment = (value: unknown) => {
    switch (value) {
      case "center":
        return docx.AlignmentType.CENTER;
      case "right":
        return docx.AlignmentType.RIGHT;
      case "justify":
        return docx.AlignmentType.JUSTIFIED;
      default:
        return undefined;
    }
  };

  function append(node: JSONContent, activeListLevel: number): void {
    if (node.type === "paragraph" || node.type === "heading") {
      const children = toRuns(node);
      if (!children.length) {
        children.push(new docx.TextRun(""));
      }
      const level = node.attrs?.level;
      const heading =
        node.type === "heading"
          ? level === 1
            ? docx.HeadingLevel.HEADING_1
            : level === 2
              ? docx.HeadingLevel.HEADING_2
              : docx.HeadingLevel.HEADING_3
          : undefined;
      paragraphs.push(
        new docx.Paragraph({
          children,
          heading,
          alignment: toAlignment(node.attrs?.textAlign),
          bullet: activeListLevel > 0 ? { level: Math.min(activeListLevel, 8) } : undefined,
          indent:
            activeListLevel > 0
              ? { left: 360 * activeListLevel }
              : undefined,
        }),
      );
      return;
    }

    if (node.type === "horizontalRule") {
      paragraphs.push(new docx.Paragraph({ text: "________________________________" }));
      return;
    }

    if (node.type === "blockquote") {
      for (const child of node.content ?? []) {
        if (child.type === "paragraph") {
          paragraphs.push(
            new docx.Paragraph({
              children: toRuns(child, [], true),
              indent: { left: 360 },
            }),
          );
        } else {
          append(child, activeListLevel);
        }
      }
      return;
    }

    if (node.type === "bulletList") {
      for (const item of node.content ?? []) {
        for (const child of item.content ?? []) {
          append(child, activeListLevel + 1);
        }
      }
      return;
    }

    if (node.type === "orderedList") {
      let index = 0;
      for (const item of node.content ?? []) {
        index += 1;
        const itemContent = item.content ?? [];
        const firstParagraph = itemContent.find(
          (child) => child.type === "paragraph",
        );
        if (firstParagraph) {
          paragraphs.push(
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: `${index}. `,
                  bold: false,
                  font: "Arial",
                }),
                ...toRuns(firstParagraph),
              ],
              indent: { left: 360 * (activeListLevel + 1) },
            }),
          );
        }
        for (const child of itemContent) {
          if (child !== firstParagraph) append(child, activeListLevel + 1);
        }
      }
      return;
    }

    for (const child of node.content ?? []) append(child, activeListLevel);
  }

  for (const node of nodes) append(node, listLevel);
  return paragraphs;
}

export async function createLessonDocx(
  title: string,
  content: JSONContent,
): Promise<File> {
  const docx = await loadDocxModule();
  const body = buildDocxParagraphs(docx, content.content ?? []);
  const document = new docx.Document({
    creator: "Trang web học tập",
    title,
    sections: [
      {
        properties: {},
        children: [
          ...body,
        ],
      },
    ],
  });
  const blob = await docx.Packer.toBlob(document);
  return new File([blob], toFilename(title, "docx"), {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function createLessonTextFile(
  title: string,
  content: JSONContent,
): File {
  const body = toPlainText(content);
  return new File([`${body}\r\n`], toFilename(title, "txt"), {
    type: "text/plain;charset=utf-8",
  });
}

export function downloadLessonFile(file: File): void {
  downloadBlob(file, file.name);
}

export async function createLessonPdfFile(
  title: string,
  editorElement: HTMLElement,
): Promise<File> {
  const wrapper = window.document.createElement("article");
  wrapper.style.cssText =
    "box-sizing:border-box;width:800px;padding:48px;background:#fff;color:#0f172a;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.75";

  const content = editorElement.parentElement?.cloneNode(true) ?? editorElement.cloneNode(true);
  wrapper.append(content);
  window.document.body.append(wrapper);

  try {
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas-pro"),
    ]);
    await document.fonts.ready;
    const canvas = await html2canvas(wrapper, {
      backgroundColor: "#ffffff",
      scale: 1.5,
      windowWidth: 800,
      useCORS: true,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const margin = 15;
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;
    const sourcePageHeight = Math.floor(
      (canvas.width * contentHeight) / contentWidth,
    );
    let sourceY = 0;

    while (sourceY < canvas.height) {
      const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
      const pageCanvas = window.document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext("2d");
      if (!context) {
        throw new Error("Không thể tạo trang PDF.");
      }
      context.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      if (sourceY > 0) {
        pdf.addPage();
      }
      const renderedHeight = (sliceHeight * contentWidth) / canvas.width;
      pdf.addImage(
        pageCanvas.toDataURL("image/jpeg", 0.94),
        "JPEG",
        margin,
        margin,
        contentWidth,
        renderedHeight,
        undefined,
        "FAST",
      );
      sourceY += sliceHeight;
    }

    const blob = pdf.output("blob");
    return new File([blob], toFilename(title, "pdf"), {
      type: "application/pdf",
    });
  } finally {
    wrapper.remove();
  }
}
