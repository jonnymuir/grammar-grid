/// <reference lib="webworker" />
import { startLanguageServer } from 'langium/lsp';
import { BrowserMessageReader, BrowserMessageWriter, createConnection } from 'vscode-languageserver/browser.js';
import { createCalculationLanguageServices } from 'calculation-language-language';

const messageReader = new BrowserMessageReader(self as any);
const messageWriter = new BrowserMessageWriter(self as any);

const connection = createConnection(messageReader, messageWriter);

// Inject the shared services and language-specific services
const { shared } = createCalculationLanguageServices({
    connection,
    fileSystemProvider: () => ({
        readFile: async (uri: string) => {
            return connection.sendRequest('browser/readFile', { uri: uri.toString() });
        },
        readBinary: async (uri: string) => {
            return connection.sendRequest('browser/readBinary', { uri: uri.toString() });
        },
        readDirectory: async (uri: string) => {
            // Log this so we can see the URI scheme in the console
            console.log('LS Worker requesting directory:', uri.toString());
            return connection.sendRequest('browser/readDirectory', { uri: uri.toString() });
        },
        exists: async (uri: string) => {
            return connection.sendRequest('browser/exists', { uri: uri.toString() });
        },
        isDirectory: async (uri: string) => {
            return connection.sendRequest('browser/isDirectory', { uri: uri.toString() });
        },
        stat: async (uri: string) => {
            return connection.sendRequest('browser/stat', { uri: uri.toString() });
        }
    } as any)
});

startLanguageServer(shared);