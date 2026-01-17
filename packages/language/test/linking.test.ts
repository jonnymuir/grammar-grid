import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { clearDocuments, parseHelper } from "langium/test";
// Update these paths to use your actual module and .js extensions
import { createCalculationLanguageServices } from "../src/calculation-language-module.js";
import { Expression, isExpression, isDataDictionaryCall } from "../src/generated/ast.js";

let services: ReturnType<typeof createCalculationLanguageServices>;
let parse:    ReturnType<typeof parseHelper<Expression>>;
let document: LangiumDocument<Expression> | undefined;

beforeAll(async () => {
    services = createCalculationLanguageServices(EmptyFileSystem);
    parse = parseHelper<Expression>(services.CalculationLanguage);
});

afterEach(async () => {
    document && clearDocuments(services.shared, [ document ]);
});

describe('Linking tests', () => {

    test('linking of data dictionary keys', async () => {
        // We test if the parser correctly identifies the 'key' in a data_dictionary call
        document = await parse(`
            data_dictionary(final_salary)
        `);

        const root = document.parseResult.value;

        expect(
            checkDocumentValid(document)
                || (isDataDictionaryCall(root) ? root.key : 'Not a DataDictionaryCall')
        ).toBe(s`
            final_salary
        `);
    });
});

function checkDocumentValid(document: LangiumDocument): string | undefined {
    return document.parseResult.parserErrors.length && s`
        Parser errors:
          ${document.parseResult.parserErrors.map(e => e.message).join('\n  ')}
    `
        || document.parseResult.value === undefined && `ParseResult is 'undefined'.`
        || !isExpression(document.parseResult.value) && `Root AST object is a ${document.parseResult.value.$type}, expected an 'Expression'.`
        || undefined;
}