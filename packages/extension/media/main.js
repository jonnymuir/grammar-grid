(function () {
    const vscode = acquireVsCodeApi();

    const state = {
        rows: 25,
        cols: 12,
        data: {},
        selectedCell: "A1"
    };

    function init() {
        renderGrid();
        // Monaco needs to be loaded via the 'require' provided by the CDN
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            registerCalculationLanguage(); // Add this line
            initMonaco();
        });
    }

    // --- NEW: Register the Language Brain ---
    function registerCalculationLanguage() {
        const LANG_ID = 'calculation-language';

        // 1. Tell Monaco the language exists
        monaco.languages.register({ id: LANG_ID });

        // 2. Define colors for your BNF (Cell refs, Numbers, Operators)
        monaco.languages.setMonarchTokensProvider(LANG_ID, {
            tokenizer: {
                root: [
                    [/[A-Z]+[0-9]+/, "custom-cell"],      // A1, B20
                    [/\d+/, "custom-number"],            // 100
                    [/[\+\-\*\/\=]/, "custom-operator"], // + - * / =
                    [/[a-zA-Z_]\w*/, "custom-variable"], // Database fields
                ]
            }
        });

        // 3. Define the theme colors
        monaco.editor.defineTheme('grid-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'custom-cell', foreground: '4EC9B0', fontStyle: 'bold' },
                { token: 'custom-number', foreground: 'B5CEA8' },
                { token: 'custom-operator', foreground: 'D4D4D4' },
                { token: 'custom-variable', foreground: '9CDCFE' },
            ],
            colors: {
                'editor.background': '#1e1e1e00', // Transparent to match your CSS bar
            }
        });

        // 4. Add "IntelliSense" Snippets
        monaco.languages.registerCompletionItemProvider(LANG_ID, {
            provideCompletionItems: (model, position) => {
                // Inside registerCompletionItemProvider
                const suggestions = [
                    {
                        label: 'SUM',
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: 'SUM(${1:value_or_cell}, ${2:another_value})', // Tab-stops $1 and $2
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: '(Number, Number) -> Number',
                        documentation: 'Adds values. Accepts numbers, cell references, or other function returns.'
                    },
                    {
                        label: 'data_dictionary',
                        kind: monaco.languages.CompletionItemKind.Struct,
                        insertText: 'data_dictionary(${1|final_salary,pension_contribution,base_pay|})', // Choice menu
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: '(Field) -> Number',
                        documentation: 'Look up a specific value from the organizational data dictionary.'
                    }
                ];
                return { suggestions: suggestions };
            }
        });

        monaco.languages.registerHoverProvider(LANG_ID, {
            provideHover: (model, position) => {
                const word = model.getWordAtPosition(position);
                if (!word) return;

                const docs = {
                    'SUM': {
                        title: '### SUM',
                        params: '- **params**: `Number | Cell | FunctionReturn` (Variadic)',
                        returns: '- **returns**: `Number`',
                        desc: 'Calculates the total of the provided inputs.'
                    },
                    'data_dictionary': {
                        title: '### data_dictionary',
                        params: '- **key**: `DictionaryField` (e.g., `final_salary`)',
                        returns: '- **returns**: `Number`',
                        desc: 'Retrieves a numeric value from the central data store.'
                    }
                };

                const doc = docs[word.word];
                if (doc) {
                    return {
                        contents: [
                            { value: doc.title },
                            { value: doc.desc },
                            { value: doc.params },
                            { value: doc.returns }
                        ]
                    };
                }
            }
        });

        monaco.languages.registerSignatureHelpProvider(LANG_ID, {
            signatureHelpTriggerCharacters: ['(', ','],
            provideSignatureHelp: (model, position) => {
                return {
                    value: {
                        signatures: [
                            {
                                label: 'SUM(range_start, range_end)',
                                parameters: [
                                    { label: 'range_start', documentation: 'The first cell in the range (e.g., A1)' },
                                    { label: 'range_end', documentation: 'The last cell in the range (e.g., A10)' }
                                ]
                            }
                        ],
                        activeSignature: 0,
                        activeParameter: 0
                    },
                    dispose: () => { }
                };
            }
        });

        monaco.languages.registerCompletionItemProvider(LANG_ID, {
            provideCompletionItems: (model, position) => {
                const suggestions = [
                    {
                        label: 'SUM',
                        kind: monaco.languages.CompletionItemKind.Function, // Function Icon
                        insertText: 'SUM(${1:A1}, ${2:A2})',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: 'Mathematical Function',
                        documentation: 'Adds numbers together.'
                    },
                    {
                        label: 'DB_REVENUE',
                        kind: monaco.languages.CompletionItemKind.Field, // Database Icon
                        insertText: 'DB_REVENUE',
                        detail: 'SQL: Finance_Data.Revenue',
                        documentation: 'Pulled live from the production database.'
                    }
                ];
                return { suggestions };
            }
        });
    }

    function initMonaco() {
        window.editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: '',
            language: 'calculation-language',
            theme: 'grid-theme', // Use our new theme
            minimap: { enabled: false },
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
            fixedOverflowWidgets: true,
            renderLineHighlight: 'none',
            padding: { top: 4 },
            fontSize: 13
        });

        function validateFormulas(model) {
            const markers = [];
            const text = model.getValue();

            // Example: POC check for unclosed brackets
            const openBrackets = (text.match(/\(/g) || []).length;
            const closedBrackets = (text.match(/\)/g) || []).length;

            if (openBrackets !== closedBrackets) {
                markers.push({
                    message: `Mismatched brackets: You have ${openBrackets} '(' but ${closedBrackets} ')'`,
                    severity: monaco.MarkerSeverity.Error,
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: 1,
                    endColumn: text.length + 1
                });
            }

            // Push the markers to the editor UI
            monaco.editor.setModelMarkers(model, 'owner', markers);
        }

        window.editor.onDidChangeModelContent(() => {
            const model = window.editor.getModel();
            validateFormulas(model);
            const val = window.editor.getValue();
            state.data[state.selectedCell] = val;
            const cell = document.getElementById(state.selectedCell);
            if (cell) cell.innerText = val;
        });
    }

    // --- GRID LOGIC (Kept same but added auto-selection) ---
    function renderGrid() {
        const body = document.getElementById('grid-body');
        const header = document.getElementById('header-row');
        header.innerHTML = '<th></th>' + [...Array(state.cols)].map((_, i) =>
            `<th>${String.fromCharCode(65 + i)}</th>`).join('');

        body.innerHTML = '';
        for (let r = 1; r <= state.rows; r++) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<th>${r}</th>` + [...Array(state.cols)].map((_, c) => {
                const id = `${String.fromCharCode(65 + c)}${r}`;
                return `<td id="${id}" tabIndex="0"></td>`;
            }).join('');
            body.appendChild(tr);
        }

        body.addEventListener('click', (e) => {
            if (e.target.tagName === 'TD') selectCell(e.target.id);
        });

        // Default select A1
        setTimeout(() => selectCell("A1"), 10);
    }

    function selectCell(id) {
        document.querySelectorAll('.selected-cell').forEach(el => el.classList.remove('selected-cell'));
        const cell = document.getElementById(id);
        if (cell) {
            cell.classList.add('selected-cell');
            state.selectedCell = id;

            if (window.editor) {
                const val = state.data[id] || '';
                window.editor.setValue(val);

                // UI Hint: If cell is empty, show a ghost prompt or set cursor
                window.editor.focus();

                // Move cursor to end
                window.editor.setPosition({
                    lineNumber: 1,
                    column: val.length + 1
                });
            }
        }
    }

    init();
}());