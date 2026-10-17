"use client";

import { useEffect, useRef } from "react";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView, crosshairCursor, drawSelection, dropCursor, highlightActiveLine,
  highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers, rectangularSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap,
} from "@codemirror/autocomplete";
import {
  StreamLanguage, bracketMatching, defaultHighlightStyle, foldGutter, foldKeymap,
  indentOnInput, indentUnit, syntaxHighlighting,
} from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { xml } from "@codemirror/lang-xml";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { rust } from "@codemirror/lang-rust";
import { php } from "@codemirror/lang-php";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import type { UserPrefs } from "@/lib/types";

function languageExtension(language: string): Extension {
  switch (language) {
    case "javascript":
      return javascript({ jsx: true });
    case "typescript":
      return javascript({ jsx: true, typescript: true });
    case "python":
      return python();
    case "html":
      return html({ autoCloseTags: true });
    case "css":
      return css();
    case "json":
      return json();
    case "sql":
      return sql();
    case "markdown":
      return markdown();
    case "yaml":
      return yaml();
    case "xml":
      return xml();
    case "cpp":
      return cpp();
    case "java":
      return java();
    case "rust":
      return rust();
    case "php":
      return php();
    case "shell":
      return StreamLanguage.define(shell);
    default:
      return [];
  }
}

const hanreDark = EditorView.theme(
  {
    "&": {
      color: "#c9cfdb",
      backgroundColor: "transparent",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "#a394ff",
      padding: "10px 0 80px",
      fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
    },
    ".cm-line": { padding: "0 16px 0 8px" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#a394ff", borderLeftWidth: "2px" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(139, 123, 255, 0.24)",
    },
    ".cm-panels": { backgroundColor: "#11141d", color: "#c9cfdb", borderColor: "rgba(255,255,255,0.08)" },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid rgba(255,255,255,0.08)" },
    ".cm-searchMatch": { backgroundColor: "rgba(251, 191, 36, 0.22)" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgba(251, 191, 36, 0.4)" },
    ".cm-tooltip": {
      backgroundColor: "#141824",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: "0 20px 50px -20px rgba(0,0,0,.8)",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgba(139,123,255,.2)",
      color: "#edeff5",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "#171b26",
      border: "none",
      color: "#7f889b",
    },
    ".cm-gutters": { backgroundColor: "transparent" },
  },
  { dark: true },
);

const hanreLight = EditorView.theme(
  {
    "&": { color: "#26231d", backgroundColor: "transparent", height: "100%" },
    ".cm-content": {
      caretColor: "#6d5ae6",
      padding: "10px 0 80px",
      fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
    },
    ".cm-line": { padding: "0 16px 0 8px" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#6d5ae6", borderLeftWidth: "2px" },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(109, 90, 230, 0.16)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(109, 90, 230, 0.05)" },
    ".cm-panels": { backgroundColor: "#fbfaf7", color: "#26231d", borderColor: "rgba(0,0,0,0.08)" },
    ".cm-tooltip": {
      backgroundColor: "#ffffff",
      border: "1px solid rgba(0,0,0,0.12)",
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: "0 20px 50px -20px rgba(35,28,15,.2)",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgba(109,90,230,.12)",
      color: "#181611",
    },
    ".cm-gutters": { backgroundColor: "transparent" },
  },
  { dark: false },
);

function themeExtension(theme: "dark" | "light"): Extension {
  if (theme === "light") {
    return [hanreLight, syntaxHighlighting(defaultHighlightStyle, { fallback: true })];
  }
  return [oneDark, hanreDark];
}

export default function CodeEditor({
  fileId,
  value,
  language,
  prefs,
  theme,
  reloadToken,
  onChange,
  onCursor,
  onSave,
  onRun,
}: {
  fileId: string;
  value: string;
  language: string;
  prefs: UserPrefs;
  theme: "dark" | "light";
  reloadToken: number;
  onChange: (value: string) => void;
  onCursor: (line: number, column: number) => void;
  onSave: () => void;
  onRun: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentsRef = useRef<{
    theme: Compartment;
    language: Compartment;
    wrap: Compartment;
    gutter: Compartment;
    tab: Compartment;
    font: Compartment;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursor);
  const onSaveRef = useRef(onSave);
  const onRunRef = useRef(onRun);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    onChangeRef.current = onChange;
    onCursorRef.current = onCursor;
    onSaveRef.current = onSave;
    onRunRef.current = onRun;
  });

  useEffect(() => {
    if (!hostRef.current) return;
    const themeCompartment = new Compartment();
    const languageCompartment = new Compartment();
    const wrapCompartment = new Compartment();
    const gutterCompartment = new Compartment();
    const tabCompartment = new Compartment();
    const fontCompartment = new Compartment();
    compartmentsRef.current = {
      theme: themeCompartment,
      language: languageCompartment,
      wrap: wrapCompartment,
      gutter: gutterCompartment,
      tab: tabCompartment,
      font: fontCompartment,
    };

    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ activateOnTyping: true }),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        gutterCompartment.of(
          prefs.lineNumbers === false
            ? []
            : [lineNumbers(), highlightActiveLineGutter(), foldGutter()],
        ),
        wrapCompartment.of(prefs.wordWrap ? EditorView.lineWrapping : []),
        tabCompartment.of([
          EditorState.tabSize.of(prefs.tabSize ?? 2),
          indentUnit.of(" ".repeat(prefs.tabSize ?? 2)),
        ]),
        fontCompartment.of(
          EditorView.theme({ "&": { fontSize: `${prefs.editorFontSize ?? 14}px` } }),
        ),
        languageCompartment.of(languageExtension(language)),
        themeCompartment.of(themeExtension(theme)),
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              onSaveRef.current();
              return true;
            },
          },
          {
            key: "Mod-Enter",
            preventDefault: true,
            run: () => {
              onRunRef.current();
              return true;
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            onCursorRef.current(line.number, head - line.from + 1);
          }
        }),
        EditorView.contentAttributes.of({ spellcheck: "false", autocapitalize: "off" }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    onCursorRef.current(1, 1);
    const timer = setTimeout(() => view.requestMeasure(), 30);

    return () => {
      clearTimeout(timer);
      view.destroy();
      viewRef.current = null;
      compartmentsRef.current = null;
    };
    // The editor is recreated per file; preference changes are reconfigured below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, language, reloadToken]);

  useEffect(() => {
    const view = viewRef.current;
    const compartments = compartmentsRef.current;
    if (!view || !compartments) return;
    view.dispatch({
      effects: [
        compartments.theme.reconfigure(themeExtension(theme)),
        compartments.wrap.reconfigure(prefs.wordWrap ? EditorView.lineWrapping : []),
        compartments.tab.reconfigure([
          EditorState.tabSize.of(prefs.tabSize ?? 2),
          indentUnit.of(" ".repeat(prefs.tabSize ?? 2)),
        ]),
        compartments.font.reconfigure(
          EditorView.theme({ "&": { fontSize: `${prefs.editorFontSize ?? 14}px` } }),
        ),
        compartments.gutter.reconfigure(
          prefs.lineNumbers === false
            ? []
            : [lineNumbers(), highlightActiveLineGutter(), foldGutter()],
        ),
      ],
    });
  }, [theme, prefs.wordWrap, prefs.tabSize, prefs.editorFontSize, prefs.lineNumbers]);

  return <div className="cm-host" ref={hostRef} data-language={language} />;
}
