import { EditorView } from "codemirror";
import { acceptCompletion, autocompletion, closeBracketsKeymap, CompletionContext, completionKeymap, CompletionSource } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { defaultKeymap, historyKeymap } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";

//linting and completions and stuff
import { Diagnostic, linter } from "@codemirror/lint";
import * as luaparse from "luaparse";

import { StreamLanguage, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import editorsetup from "./editorsetup";
import { tags } from "@lezer/highlight";

import source from "./completions";

//other things
import * as explorer from "./explorer";
import * as notifications from "./notifications";

notifications.init(document.querySelector(".notifications") as HTMLDivElement);

const tabKeymap = {
    key: "Tab",
    run: (view: EditorView) => {
        if (acceptCompletion(view)) return true;

        view.dispatch({
            changes: {
                from: view.state.selection.main.head,
                insert: "\t"
            },
            selection: { anchor: view.state.selection.main.head + 1 },
            scrollIntoView: true,
            annotations: Transaction.userEvent.of("input")
        });
        return true;
    }
}

const luaLinter = linter(view => {
    const diagnostics: Diagnostic[] = [];
    const code = view.state.doc.toString();

    try {
        luaparse.parse(code, {
            locations: true,
            ranges: true,
            luaVersion: "5.1"
        });
    } catch (e: any) {
        if (e.index !== undefined) {
            diagnostics.push({
                from: e.index,
                to: e.index + 1,
                severity: "error",
                message: e.message.replace(/^\[.*\]\s*/, ""),
                actions: []
            })
        }
    }

    return diagnostics;
});

const luaHighlighter = HighlightStyle.define([
    {tag: tags.keyword, color: "#FF7B72"},
    {tag: tags.variableName, color: "#79C0FF"},
    {tag: tags.string, color: "	#A5D6FF"},
    {tag: tags.number, color: "	#B5CEA8"},
    {tag: tags.comment, color: "#8B949E", fontStyle: "italic"},
]);

const theme = EditorView.theme({
    "&": {
        color: "white",
        backgroundColor: "#121314"
    },
    ".cm-content": {
        caretColor: "#aeafad"
    },
    ".cm-gutters": {
        backgrounColor: "#121314",
        color: "#aeafad",
        border: "none"
    },
    ".cm-activeLine": {
        backgroundColor: "rgba(255, 255, 255, 0.1)"
    },
}, {dark: true});

const view = new EditorView({
    parent: document.getElementById("editor") as Element,
    extensions: [
        editorsetup,
        luaLinter,
        keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap,
            tabKeymap
        ]),
        syntaxHighlighting(luaHighlighter),
        StreamLanguage.define(lua),
        autocompletion({ override: [source as CompletionSource] }),
        theme
    ]
});

await explorer.init(
    document.getElementById("explorer") as HTMLDivElement,
    document.getElementById("new-file-btn") as HTMLButtonElement,
    document.getElementById("new-folder-btn") as HTMLButtonElement,
);
notifications.sendNotification("Welcome!");