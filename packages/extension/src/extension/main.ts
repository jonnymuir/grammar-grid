import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node.js';
import * as vscode from 'vscode';
import * as path from 'node:path';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node.js';

let client: LanguageClient;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // 1. Start the Language Server (The BNF Brain)
    client = await startLanguageClient(context);

    // 2. Register the GrammarGrid Command (The UI)
    context.subscriptions.push(
        vscode.commands.registerCommand('grammarGrid.open', () => {
            const panel = vscode.window.createWebviewPanel(
                'grammarGrid',
                'GrammarGrid POC',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
                }
            );

            panel.webview.html = getHtmlForWebview(panel.webview, context.extensionUri);
        })
    );
}

export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}

// --- UI HELPER ---
function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'style.css'));

    // Note: We removed Handsontable CDNs and added a container for our custom table
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
                <thead>
                    <tr id="header-row">
                        </tr>
                </thead>
                <tbody id="grid-body">
                    </tbody>
            </table>
        </div>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}

// --- LANGUAGE SERVER SETUP ---
async function startLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
    const serverModule = context.asAbsolutePath(path.join('out', 'language', 'main.cjs'));
    const debugOptions = { execArgv: ['--nolazy', `--inspect${process.env.DEBUG_BREAK ? '-brk' : ''}=${process.env.DEBUG_SOCKET || '6009'}`] };

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: '*', language: 'calculation-language' }]
    };

    const client = new LanguageClient(
        'calculation-language',
        'CalculationLanguage',
        serverOptions,
        clientOptions
    );

    await client.start();
    return client;
}