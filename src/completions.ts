import { Completion, CompletionContext, CompletionResult, completionStatus } from "@codemirror/autocomplete";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";

function completeVariableName(context: CompletionContext): Completion[] {
    const doc = context.state.doc.toString();
    const names = doc.match(/\b(?:local\s+)?([a-zA-Z_]\w*)\s*(?=[=,)]|$)/g);
    const word = context.matchBefore(/\w*$/);

    const completions: Completion[] = [];

    names?.map(name => {
        if (word?.text != name)
            completions.push({label: name.replace("local", "").trim(), type: "variable"});
        
    });
    return completions;
}
function completeFunctionName(context: CompletionContext): Completion[] {
    const doc = context.state.doc.toString();
    const names = doc.match(/(function )\w+/g);
    const word = context.matchBefore(/\w*$/);

    const completions: Completion[] = [];

    names?.map(name => {
        if (word?.text != name)
            completions.push({label: name.replace("function ", "").trim(), type: "function"});
        
    });
    return completions;
}
export default function(context: CompletionContext): CompletionResult | null {
    const completions: Completion[] = [];

    const word = context.matchBefore(/\w*/);
    if (!word || (word.from == word.to && !context.explicit)) return null;

    const ast = syntaxTree(context.state).resolveInner(word.from, -1);
    const prev = context.state.sliceDoc(context.state.doc.lineAt(context.pos).from, ast.to);

    console.log(prev)
    if (prev == "string" || prev == "comment") return null;

    if (prev.match(/^\s*\w*$/)) {
        completions.push(...[
            { label: "function", type: "keyword" },
            { label: "local", type: "keyword" },
            { label: "if", type: "keyword" },
            { label: "for", type: "keyword" },
            { label: "while", type: "keyword" },
            { label: "repeat", type: "keyword" },
            { label: "until", type: "keyword" },
        ]);
    }
    if (prev.match(/for \w(, \w)?\s*[i, n]?\s/)) { // for loop (for i(, v) in)
        if (prev.includes(" in ")) {
            completions.push(...[
                { label: "pairs", type: "function" },
                { label: "ipairs", type: "function" }
            ]);
        } else {
            completions.push({ label: "in", type: "keyword" })
        }
    }
    if (prev.match(/^local\s*[f,u,n,c,t,i,o,n]*$/)) { // for local functions
        completions.push({ label: "function", type: "keyword" });
    }

    completions.push(...completeVariableName(context));
    completions.push(...completeFunctionName(context));

    return {from: word.from, options: completions};
}