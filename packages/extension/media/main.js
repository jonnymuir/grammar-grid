(function () {
    const vscode = acquireVsCodeApi();

    // 1. DATA STATE: Parameter-centric model matching Procentia IntelliCalcs
    const state = {
        selectedRowId: 'sal_01',
        rows: [
            { id: 'header_1', label: 'Member Core Data', isHeader: true },
            { id: 'sal_01', label: 'Final Pensionable Salary', source: 'DB', type: 'Number', note: 'Based on last 36 months average' },
            { id: 'srv_01', label: 'Total Qualifying Service', source: 'MANUAL', type: 'Years', note: 'Checked against paper records 2024' },
            { id: 'header_2', label: 'Benefit Calculation', isHeader: true },
            { id: 'acc_01', label: 'Accrual Rate', source: 'CONST', type: 'Factor', note: 'Standard 1/60th Scheme Rule' },
            { id: 'ret_01', label: 'Annual Pension', source: 'CALC', type: 'Currency', note: '' }
        ],
        values: {
            'sal_01': '=data_dictionary(final_salary)',
            'srv_01': '24.5',
            'acc_01': '0.01667',
            'ret_01': '=SUM(sal_01 * srv_01 * acc_01)'
        }
    };

    function init() {
        renderGrid();
        
        // Monaco Loader from CDN
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            registerCalculationLanguage();
            initMonaco();
            // Default selection on load
            selectRow('sal_01');
        });
    }

    // --- GRID RENDERING ---
    function renderGrid() {
        const body = document.getElementById('grid-body');
        if (!body) return;
        body.innerHTML = '';

        state.rows.forEach(row => {
            const tr = document.createElement('tr');
            
            if (row.isHeader) {
                tr.className = 'group-header';
                tr.innerHTML = `<td colspan="5">${row.label}</td>`;
            } else {
                tr.id = `row-${row.id}`;
                tr.className = 'data-row';
                tr.innerHTML = `
                    <td class="id-cell">${row.id}</td>
                    <td class="label-cell"><strong>${row.label}</strong></td>
                    <td class="value-cell" id="val-${row.id}">${state.values[row.id] || ''}</td>
                    <td class="source-cell"><span class="badge ${row.source.toLowerCase()}">${row.source}</span></td>
                    <td class="note-cell"><input type="text" class="note-input" value="${row.note || ''}" data-id="${row.id}" placeholder="Add note..."></td>
                `;
                tr.onclick = () => selectRow(row.id);
            }
            body.appendChild(tr);
        });

        // Event listener for Note updates
        document.querySelectorAll('.note-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const row = state.rows.find(r => r.id === id);
                if (row) row.note = e.target.value;
            });
        });
    }

    function selectRow(id) {
        // Update UI selection
        document.querySelectorAll('.data-row').forEach(el => el.classList.remove('selected-row'));
        const rowEl = document.getElementById(`row-${id}`);
        if (rowEl) {
            rowEl.classList.add('selected-row');
            state.selectedRowId = id;

            // Update Monaco Editor content
            if (window.editor) {
                const val = state.values[id] || '';
                window.editor.setValue(val);
                window.editor.focus();
                
                // Position cursor at end of text
                window.editor.setPosition({
                    lineNumber: 1,
                    column: val.length + 1
                });
            }
        }
    }

    // --- MONACO LANGUAGE REGISTRATION ---
    function registerCalculationLanguage() {
        const LANG_ID = 'calculation-language';

        monaco.languages.register({ id: LANG_ID });

        // Syntax Highlighting (Monarch)
        monaco.languages.setMonarchTokensProvider(LANG_ID, {
            tokenizer: {
                root: [
                    [/[a-z]{3}_[0-9]{2}/, "custom-row-id"], // Matches sal_01, ret_01
                    [/\d+(\.\d+)?/, "custom-number"],
                    [/[\+\-\*\/\=]/, "custom-operator"],
                    [/[a-zA-Z_]\w*/, "custom-variable"],
                ]
            }
        });

        // Theme
        monaco.editor.defineTheme('grid-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'custom-row-id', foreground: '4EC9B0', fontStyle: 'bold' },
                { token: 'custom-number', foreground: 'B5CEA8' },
                { token: 'custom-operator', foreground: 'D4D4D4' },
                { token: 'custom-variable', foreground: '9CDCFE' },
            ],
            colors: {
                'editor.background': '#1e1e1e00', 
            }
        });

        // Intellisense / Completions
        monaco.languages.registerCompletionItemProvider(LANG_ID, {
            provideCompletionItems: (model, position) => {
                const suggestions = [
                    {
                        label: 'SUM',
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: 'SUM(${1:val1}, ${2:val2})',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: 'Mathematical Sum',
                        documentation: 'Adds numbers or row references together.'
                    },
                    {
                        label: 'data_dictionary',
                        kind: monaco.languages.CompletionItemKind.Struct,
                        insertText: 'data_dictionary(${1|final_salary,pension_contribution,base_pay|})',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: 'Database Lookup',
                        documentation: 'Fetches a member value from the SQL Data Dictionary.'
                    }
                ];
                return { suggestions };
            }
        });

        // Hover Information
        monaco.languages.registerHoverProvider(LANG_ID, {
            provideHover: (model, position) => {
                const word = model.getWordAtPosition(position);
                if (!word) return;

                const docs = {
                    'SUM': {
                        title: '### SUM',
                        desc: 'Calculates the total of the provided inputs.',
                        params: '- **params**: `Number | RowID | Function`'
                    },
                    'data_dictionary': {
                        title: '### data_dictionary',
                        desc: 'Retrieves a numeric value from the central data store.',
                        params: '- **key**: `DictionaryField` (e.g., `final_salary`)'
                    }
                };

                const doc = docs[word.word];
                if (doc) {
                    return {
                        contents: [
                            { value: doc.title },
                            { value: doc.desc },
                            { value: doc.params }
                        ]
                    };
                }
            }
        });

        // Signature Help
        monaco.languages.registerSignatureHelpProvider(LANG_ID, {
            signatureHelpTriggerCharacters: ['(', ','],
            provideSignatureHelp: (model, position) => {
                return {
                    value: {
                        signatures: [{
                            label: 'SUM(value1, value2, ...)',
                            parameters: [
                                { label: 'value1', documentation: 'First number or reference' },
                                { label: 'value2', documentation: 'Second number or reference' }
                            ]
                        }],
                        activeSignature: 0,
                        activeParameter: 0
                    },
                    dispose: () => { }
                };
            }
        });
    }

    // --- MONACO INITIALIZATION ---
    function initMonaco() {
        window.editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: '',
            language: 'calculation-language',
            theme: 'grid-theme',
            minimap: { enabled: false },
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
            fixedOverflowWidgets: true,
            renderLineHighlight: 'none',
            fontSize: 13,
            padding: { top: 4 }
        });

        // Real-time Validation and State Sync
        window.editor.onDidChangeModelContent(() => {
            const val = window.editor.getValue();
            
            // 1. Sync value to state
            state.values[state.selectedRowId] = val;
            
            // 2. Update Grid Display
            const cell = document.getElementById(`val-${state.selectedRowId}`);
            if (cell) cell.innerText = val;

            // 3. Simple Diagnostic Marker (POC)
            const markers = [];
            const open = (val.match(/\(/g) || []).length;
            const close = (val.match(/\)/g) || []).length;
            if (open !== close) {
                markers.push({
                    message: `Mismatched brackets: ${open} open, ${close} closed.`,
                    severity: monaco.MarkerSeverity.Error,
                    startLineNumber: 1, startColumn: 1,
                    endLineNumber: 1, endColumn: val.length + 1
                });
            }
            monaco.editor.setModelMarkers(window.editor.getModel(), 'owner', markers);
        });
    }

    init();
}());