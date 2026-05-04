import { bracketMatching, defaultHighlightStyle, foldGutter, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import { drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, lineNumbers } from "@codemirror/view";
import { history } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { lintGutter } from "@codemirror/lint";

export default [
	lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
    bracketMatching(),
    closeBrackets(),
    indentUnit.of("\t"),
	lintGutter()
]