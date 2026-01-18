import * as vscode from 'vscode';
import type { BaseLanguageClient, LanguageClientOptions } from 'vscode-languageclient';

let client: BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    if (vscode.env.uiKind === vscode.UIKind.Web) {
        client = await startLanguageClientWeb(context);
    } else {
        client = await startLanguageClientDesktop(context);
    }

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

        const updateWebview = () => {
            const text = document.getText();
            let data;
            try {
                data = text.trim().length === 0 ? this.getBlankTemplate() : JSON.parse(text);
            } catch {
                data = this.getBlankTemplate();
            }
            webviewPanel.webview.postMessage({ type: 'loadData', data });
        };

        webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.type === 'ready') updateWebview();
            if (e.type === 'saveData') this.updateTextDocument(document, e.data);
        });

        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length > 0) {
                // Update logic if needed
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

async function startLanguageClientDesktop(context: vscode.ExtensionContext): Promise<BaseLanguageClient> {
    const { LanguageClient, TransportKind } = await import('vscode-languageclient/node.js');
    const serverModule = vscode.Uri.joinPath(context.extensionUri, 'out', 'language', 'main.cjs').fsPath;
    const serverOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'calculation-language' }]
    };

    const client = new LanguageClient('calculation-language', 'CalculationLanguage', serverOptions, clientOptions);
    await client.start();
    return client;
}

async function startLanguageClientWeb(context: vscode.ExtensionContext): Promise<BaseLanguageClient> {
    const { LanguageClient } = await import('vscode-languageclient/browser.js');

    const serverMain = vscode.Uri.joinPath(context.extensionUri, 'out', 'language', 'main-browser.js');
    const worker = new Worker(serverMain.toString(true));

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'vscode-vfs', language: 'calculation-language' },
            { scheme: 'vscode-test-web', language: 'calculation-language' },
            { language: 'calculation-language' }
        ]
    };

    const client = new LanguageClient('calculation-language', 'CalculationLanguage', clientOptions, worker);
    
    // Start the client
    await client.start();

   // --- FS BRIDGE LISTENERS ---
    client.onRequest('browser/readDirectory', async (params: { uri: string }) => {
        try {
            const uri = vscode.Uri.parse(params.uri);
            // We must ensure we don't try to read 'file://' schemes in the web
            if (uri.scheme === 'file') {
                console.warn('Blocked attempt to read file:// scheme in browser');
                return [];
            }
            return await vscode.workspace.fs.readDirectory(uri);
        } catch (err) {
            console.error('FS Bridge readDirectory Error:', err);
            return []; // Return empty instead of crashing
        }
    });

    client.onRequest('browser/readFile', async (params: { uri: string }) => {
        try {
            const uri = vscode.Uri.parse(params.uri);
            return await vscode.workspace.fs.readFile(uri);
        } catch (err) {
            console.error('FS Bridge readFile Error:', err);
            throw err;
        }
    });

    client.onRequest('browser/exists', async (params: { uri: string }) => {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.parse(params.uri));
            return true;
        } catch {
            return false;
        }
    });

    return client;
}

function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
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