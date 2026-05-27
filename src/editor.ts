import { EditorView } from "codemirror";
import { acceptCompletion, autocompletion, closeBracketsKeymap, CompletionContext, completionKeymap, CompletionSource } from "@codemirror/autocomplete";
import { keymap, ViewUpdate } from "@codemirror/view";
import { defaultKeymap, historyKeymap } from "@codemirror/commands";
import { Compartment, Transaction } from "@codemirror/state";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";

//linting and completions and stuff
import { Diagnostic, linter } from "@codemirror/lint";
import * as luaparse from "luaparse";

import { StreamLanguage, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import editorsetup from "./editorsetup";
import { tags } from "@lezer/highlight";

import source from "./completions";

import * as idb from "./idb";

//other things
import * as explorer from "./explorer";
import * as notifications from "./notifications";

const topbarOpenFile = document.getElementById("topbar-openfile") as HTMLDivElement;
const topbarSaveStatus = document.getElementById("topbar-savestatus") as HTMLDivElement;

const startButton = document.getElementById("start-button") as HTMLButtonElement;
const stopButton = document.getElementById("stop-button") as HTMLButtonElement;
const outputCanvas = document.getElementById("canvas") as HTMLIFrameElement;
const resizer = document.querySelector(".editor-resizer") as HTMLDivElement;
const editor = document.querySelector(".editor") as HTMLDivElement;
const detector = (document.querySelector(".resize-detector") as HTMLDivElement);

const terminal = document.querySelector(".terminal") as HTMLDivElement;

let unsaved = true;

let openFile: string;

notifications.init(document.querySelector(".notifications") as HTMLDivElement);

resizer.addEventListener("mousedown", event => {
    event.preventDefault();
    detector.style.display = "block";
    function onMove(e: MouseEvent) {
        const rect = editor.getBoundingClientRect();
        editor.style.width = rect.width + e.movementX + "px";
    }
    function onUp(e: MouseEvent) {
        detector.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        detector.style.display = "none";
    }
    detector.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
})

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

const luaCompartment = new Compartment();

let lastTimeout: number;
function save(update?: EditorView | ViewUpdate) {
    if (!update) {
        update = view;
    }
    clearTimeout(lastTimeout);
    topbarSaveStatus.textContent = "Unsaved!";
    unsaved = true;
    lastTimeout = setTimeout(() => {
        topbarSaveStatus.textContent = "Saving...";
        const encoder = new TextEncoder();
        idb.insert(openFile, encoder.encode(update.state.doc.toString())).then(() => {
            topbarSaveStatus.textContent = "Saved!";
            unsaved = false;
        }).catch((reason) => {
            topbarSaveStatus.textContent = "Failed to save!";
            notifications.sendNotification(`Failed to save file: ${reason}`);
        });
    }, 500);
}

const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
        save(update);
    }
});

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
            ...searchKeymap,
            tabKeymap
        ]),
        highlightSelectionMatches(),
        luaCompartment.of([
            syntaxHighlighting(luaHighlighter),
            StreamLanguage.define(lua),
            autocompletion({ override: [source as CompletionSource] }),
        ]),
        theme,
        updateListener
    ]
});

function setLua(enabled: boolean) {
    view.dispatch({
        effects: luaCompartment.reconfigure(enabled ? [
            syntaxHighlighting(luaHighlighter),
            StreamLanguage.define(lua),
            autocompletion({ override: [source as CompletionSource] })
        ] : [])
    });
}

openFile = "main.lua";

await explorer.init(
    document.getElementById("explorer") as HTMLDivElement,
    document.getElementById("new-file-btn") as HTMLButtonElement,
    document.getElementById("new-folder-btn") as HTMLButtonElement,
    document.getElementById("upload-file-btn") as HTMLButtonElement,
    (content: Uint8Array, filename: string) => {
        topbarSaveStatus.textContent = "Loading...";
        const encoder = new TextEncoder();
        idb.insert(openFile, encoder.encode(view.state.doc.toString())).then(() => {
            topbarSaveStatus.textContent = "Loaded!";

            const extension = explorer.getFileExtension(filename);
            console.debug(`Opening file ${filename} with extension ${extension}`)
            if (extension == "lua") {
                setLua(true);
            } else {
                setLua(false);
            }
            
            const text = new TextDecoder("utf-8").decode(content);
            console.debug("Loaded main.lua:", text);
            view.dispatch({
                changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: text
                }
            });
        
            topbarOpenFile.textContent = filename;
            openFile = filename;
        }).catch((reason) => {
            topbarSaveStatus.textContent = "Failed to save!";
            notifications.sendNotification(`Failed to save file: ${reason}`);
        });
    }
);

function writeLog(text: string) {
    const newElem = document.createElement("div");
    newElem.textContent = text;
    terminal.prepend(newElem);
}

async function onLoad() {
    const files = await idb.getAll(true);
    outputCanvas.contentWindow?.postMessage({
        type: "START_GAME",
        files: files
    }, "*");
}
function onMessage(event: MessageEvent) {
    if (event.data.type == "LOG") {
        console.log("[love]", event.data.content);
        writeLog(event.data.content);
    }
    if (event.data.type == "ERROR") {
        console.error("[love]", event.data.content);
    }
}

async function start() {
    outputCanvas.onload = onLoad;
    window.addEventListener("message", onMessage);
    outputCanvas.src = "lovejs/runner.html";
    outputCanvas.focus();
}
function stop() {
    outputCanvas.removeEventListener("load", onLoad);
    window.removeEventListener("message", onMessage);
    outputCanvas.src = "";
}
startButton.addEventListener("click", () => {
    stop();
    start();
});
stopButton.addEventListener("click", () => {
    stop();
});

window.addEventListener("beforeunload", e => {
    if (unsaved) {
        e.preventDefault();
        e.returnValue = "yo dawg its unsaved";
        return e.returnValue;
    }
});

notifications.sendNotification("Welcome!");