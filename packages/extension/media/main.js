(function () {
    const vscode = acquireVsCodeApi();

    // The state now starts empty; it will be populated by the JSON file
    let state = {
        selectedRowId: null,
        activeField: 'value',
        rows: [],
        values: {}
    };

    // --- MESSAGE HANDLING ---

    // Handle data coming FROM the extension (Extension Host -> Webview)
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'loadData':
                state.rows = message.data.rows || [];
                state.values = message.data.values || {};
                
                // If no row is selected yet, pick the first non-header row
                if (!state.selectedRowId && state.rows.length > 0) {
                    const firstDataRow = state.rows.find(r => !r.isHeader);
                    if (firstDataRow) state.selectedRowId = firstDataRow.id;
                }
                
                renderGrid();
                
                // Sync the editor with the newly loaded data
                if (window.editor && state.selectedRowId) {
                    updateEditorFromState();
                }
                break;
        }
    });

    // Helper to send data TO the extension (Webview -> Extension Host)
    function saveToDisk() {
        vscode.postMessage({
            type: 'saveData',
            data: {
                rows: state.rows,
                values: state.values
            }
        });
    }

    function init() {
        // Tell the extension we are ready to receive data
        vscode.postMessage({ type: 'ready' });

        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            registerCalculationLanguage();
            registerSourceLanguage();
            initMonaco();
            renderGrid();
        });
    }

    function tidyRows() {
        state.rows = state.rows.filter((row, index) => {
            if (row.isHeader) return true;
            const hasContent = (row.id && row.id.trim() !== '') || (row.label && row.label.trim() !== '') || (row.note && row.note.trim() !== '');
            const isCurrentlyEditing = row.id === state.selectedRowId;
            const isLastRow = index === state.rows.length - 1;
            return hasContent || isCurrentlyEditing || isLastRow;
        });

        const lastRow = state.rows[state.rows.length - 1];
        if (lastRow && (lastRow.id !== '' || lastRow.label !== '' || lastRow.isHeader)) {
            state.rows.push({ id: '', label: '', source: 'MANUAL', type: '', note: '', isHeader: false });
        }
    }

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
                tr.className = 'data-row';
                tr.innerHTML = `<td class="id-cell ${isSelected(row.id, 'id')}" data-field="id">${row.id || ''}</td>` +
                    `<td class="label-cell ${isSelected(row.id, 'label')}" data-field="label">${row.label || ''}</td>` +
                    `<td class="value-cell ${isSelected(row.id, 'value')}" data-field="value">${state.values[row.id] || ''}</td>` +
                    `<td class="source-cell ${isSelected(row.id, 'source')}" data-field="source">` +
                    `<span class="badge ${row.source ? row.source.toLowerCase() : 'manual'}">${row.source || 'MANUAL'}</span>` +
                    `</td>` +
                    `<td class="note-cell ${isSelected(row.id, 'note')}" data-field="note">${row.note || ''}</td>`;

                tr.querySelectorAll('td').forEach(td => {
                    td.addEventListener('click', () => selectCell(row.id, td.getAttribute('data-field')));
                });
            }
            body.appendChild(tr);
        });
    }

    function isSelected(id, field) {
        return (state.selectedRowId === id && state.activeField === field) ? 'selected-cell' : '';
    }

    function selectCell(id, field) {
        state.selectedRowId = id;
        state.activeField = field;
        
        const fxLabel = document.getElementById('fx-label');
        if (fxLabel) {
            fxLabel.innerText = (field === 'value') ? 'fx' : 'Edit';
            fxLabel.className = (field === 'value') ? 'mode-formula' : 'mode-edit';
        }

        renderGrid();
        updateEditorFromState();
    }

    function updateEditorFromState() {
        if (!window.editor || !state.selectedRowId) return;

        const row = state.rows.find(r => r.id === state.selectedRowId);
        let content = (state.activeField === 'value') 
            ? (state.values[state.selectedRowId] || '') 
            : (row ? row[state.activeField] || '' : '');

        // Prevent cursor jump by only setting value if it differs
        if (window.editor.getValue() !== content) {
            window.editor.setValue(content);
        }
        
        setEditorMode(state.activeField);
        window.editor.focus();
    }

    function setEditorMode(field) {
        const model = window.editor.getModel();
        if (field === 'value') {
            monaco.editor.setModelLanguage(model, 'calculation-language');
        } else if (field === 'source') {
            monaco.editor.setModelLanguage(model, 'source-language');
        } else {
            monaco.editor.setModelLanguage(model, 'plaintext');
        }
    }

    function registerCalculationLanguage() {
        const LANG_ID = 'calculation-language';
        monaco.languages.register({ id: LANG_ID });
        monaco.languages.setMonarchTokensProvider(LANG_ID, {
            tokenizer: {
                root: [
                    [/[a-z]{3}_[0-9]{2}/, "custom-row-id"],
                    [/\d+(\.\d+)?/, "custom-number"],
                    [/[\+\-\*\/\=]/, "custom-operator"],
                    [/(SUM|data_dictionary)(?=\()/, "custom-keyword"],
                    [/[a-zA-Z_]\w*/, "custom-variable"],
                ]
            }
        });

        monaco.editor.defineTheme('grid-theme', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'custom-row-id', foreground: '4EC9B0', fontStyle: 'bold' },
                { token: 'custom-number', foreground: 'B5CEA8' },
                { token: 'custom-operator', foreground: 'D4D4D4' },
                { token: 'custom-keyword', foreground: 'C586C0', fontStyle: 'bold' },
                { token: 'custom-variable', foreground: '9CDCFE' },
                { token: 'custom-source', foreground: 'D19A66', fontStyle: 'bold' }
            ],
            colors: { 'editor.background': '#1e1e1e00' }
        });

        monaco.languages.registerCompletionItemProvider(LANG_ID, {
            provideCompletionItems: (model, position) => {
                return {
                    suggestions: [
                        { label: 'SUM', kind: monaco.languages.CompletionItemKind.Function, insertText: 'SUM(${1:val1}, ${2:val2})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
                        { label: 'data_dictionary', kind: monaco.languages.CompletionItemKind.Struct, insertText: 'data_dictionary(${1|final_salary,pension_contribution,base_pay|})', insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet }
                    ]
                };
            }
        });
    }

    function registerSourceLanguage() {
        const LANG_ID = 'source-language';
        monaco.languages.register({ id: LANG_ID });
        monaco.languages.setMonarchTokensProvider(LANG_ID, {
            tokenizer: { root: [[/DB|CALC|MANUAL|CONST/, "custom-source"]] }
        });
        monaco.languages.registerCompletionItemProvider(LANG_ID, {
            provideCompletionItems: () => {
                const sources = ['DB', 'CALC', 'MANUAL', 'CONST'];
                return {
                    suggestions: sources.map(s => ({
                        label: s, kind: monaco.languages.CompletionItemKind.Enum, insertText: s
                    }))
                };
            }
        });
    }

    const FIELDS = ['id', 'label', 'value', 'source', 'note'];

    function navigate(direction) {
        const currentIndex = state.rows.findIndex(r => r.id === state.selectedRowId);
        const fieldIndex = FIELDS.indexOf(state.activeField);
        let nextFieldIndex = fieldIndex + direction;
        let nextRowIndex = currentIndex;

        if (nextFieldIndex >= FIELDS.length) { nextFieldIndex = 0; nextRowIndex++; }
        else if (nextFieldIndex < 0) { nextFieldIndex = FIELDS.length - 1; nextRowIndex--; }

        const nextRow = state.rows[nextRowIndex];
        if (nextRow && !nextRow.isHeader) {
            selectCell(nextRow.id, FIELDS[nextFieldIndex]);
        }
    }

    function updateEditorHeight() {
        if (!window.editor) return;
        const container = document.getElementById('editor-container');
        const contentHeight = window.editor.getContentHeight();
        const newHeight = Math.min(Math.max(contentHeight + 4, 28), 400);
        container.style.height = `${newHeight}px`;
        window.editor.layout();
    }

    function initMonaco() {
        window.editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: '',
            language: 'calculation-language',
            theme: 'grid-theme',
            minimap: { enabled: false },
            lineNumbers: 'off',
            glyphMargin: false,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
            fontSize: 13,
            lineHeight: 20,
            padding: { top: 4, bottom: 0 }
        });

        window.editor.onDidContentSizeChange(updateEditorHeight);

        window.editor.onDidChangeModelContent(() => {
            const val = window.editor.getValue();
            const row = state.rows.find(r => r.id === state.selectedRowId);
            if (!row && state.activeField !== 'value') return;

            if (state.activeField === 'value') {
                state.values[state.selectedRowId] = val;
                validateFormula(val);
            } else if (row) {
                if (state.activeField === 'id') {
                    const oldId = row.id;
                    if (oldId !== val) {
                        state.values[val] = state.values[oldId];
                        delete state.values[oldId];
                        state.selectedRowId = val;
                    }
                }
                row[state.activeField] = val;
            }
            tidyRows();
            renderGrid();
            saveToDisk(); // Persistence trigger
        });

        window.editor.addCommand(monaco.KeyCode.Tab, () => navigate(1), '!suggestWidgetVisible');
        window.editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Tab, () => navigate(-1));
        window.editor.addCommand(monaco.KeyCode.Enter, () => {
            const idx = state.rows.findIndex(r => r.id === state.selectedRowId);
            if (idx < state.rows.length - 1) selectCell(state.rows[idx + 1].id, state.activeField);
        }, '!suggestWidgetVisible');

        setTimeout(updateEditorHeight, 50);
    }

    function validateFormula(val) {
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
    }

    init();
}());