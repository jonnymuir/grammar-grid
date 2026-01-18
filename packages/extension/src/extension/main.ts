import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node.js';
import * as vscode from 'vscode';
import * as path from 'node:path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    client = await startLanguageClient(context);

    // Register our Custom Editor Provider
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'grammarGrid.editor',
            new GrammarGridProvider(context)
        )
    );
}

class GrammarGridProvider implements vscode.CustomTextEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = { enableScripts: true };
        webviewPanel.webview.html = getHtmlForWebview(webviewPanel.webview, this.context.extensionUri);

        // 1. Initial Load: Send file content to Webview
        const updateWebview = () => {
            const text = document.getText();
            let data;
            try {
                // If file is empty, use a blank template
                data = text.trim().length === 0 ? this.getBlankTemplate() : JSON.parse(text);
            } catch {
                data = this.getBlankTemplate();
            }
            webviewPanel.webview.postMessage({ type: 'loadData', data });
        };

        // 2. Listen for messages from Webview
        webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.type === 'ready') {
                updateWebview();
            }
            if (e.type === 'saveData') {
                this.updateTextDocument(document, e.data);
            }
        });

        // 3. Optional: Update webview if the file changes externally
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length > 0) {
                // To avoid loops, only update if the change didn't come from our UI
            }
        });

        webviewPanel.onDidDispose(() => changeDocumentSubscription.dispose());
    }

    private getBlankTemplate() {
        return {
            rows: [
                { id: 'header_1', label: 'New Calculation', isHeader: true },
                { id: 'row_01', label: 'Item 1', source: 'MANUAL', type: '', note: '' }
            ],
            values: { 'row_01': '' }
        };
    }

    private updateTextDocument(document: vscode.TextDocument, data: any) {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            JSON.stringify(data, null, 4)
        );
        return vscode.workspace.applyEdit(edit);
    }
}

export function deactivate(): Thenable<void> | undefined {
    return client ? client.stop() : undefined;
}

function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="${styleUri}">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs/loader.min.js"></script>
    </head>
    <body>
        <div id="formula-bar">
            <div id="fx-label">fx</div>
            <div id="editor-container"></div>
        </div>
        <div id="grid-wrapper">
            <table id="grid-table">
                <thead><tr id="header-row"></tr></thead>
                <tbody id="grid-body"></tbody>
            </table>
        </div>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}

async function startLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
    const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.cjs'));
    const debugOptions = { execArgv: ['--nolazy', `--inspect=6009`] };
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'vscode-webview-resource', language: 'calculation-language' },
        { scheme: 'untitled', language: 'calculation-language' }]
    };
    const client = new LanguageClient('calculation-language', 'CalculationLanguage', serverOptions, clientOptions);
    await client.start();
    return client;
}