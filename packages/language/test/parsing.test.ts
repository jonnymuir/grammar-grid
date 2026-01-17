import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { parseHelper } from "langium/test";
import { createCalculationLanguageServices } from '../src/calculation-language-module.js';
import { isExpression } from "../src/generated/ast.js";
import { Expression, isBinaryExpression, isFunctionCall, isDataDictionaryCall } from "../src/generated/ast.js";

let services: ReturnType<typeof createCalculationLanguageServices>;
let parse:    ReturnType<typeof parseHelper<Expression>>;
let document: LangiumDocument<Expression> | undefined;

beforeAll(async () => {
    services = createCalculationLanguageServices(EmptyFileSystem);
    parse = parseHelper<Expression>(services.CalculationLanguage);
});

describe('Parsing tests', () => {

    test('parse nested Expression', async () => {
        // Test a formula that uses nesting: SUM and data_dictionary
        document = await parse(`SUM(10, data_dictionary(final_salary))`);

        expect(
            checkDocumentValid(document) || s`
                Root Type: ${document.parseResult.value.$type}
                Content: ${summarizeExpression(document.parseResult.value)}
            `
        ).toBe(s`
            Root Type: FunctionCall
            Content: SUM(10, data_dictionary(final_salary))
        `);
    });
});

/**
 * Helper to turn your new AST into a string for easy comparison in tests
 */
function summarizeExpression(expr: Expression): string {
    if (isFunctionCall(expr)) {
        return `${expr.functionName}(${expr.arguments.map(summarizeExpression).join(', ')})`;
    }
    if (isDataDictionaryCall(expr)) {
        return `data_dictionary(${expr.key})`;
    }
    if (isBinaryExpression(expr)) {
        return `Binary(${expr.operator})`;
    }
    if ('value' in expr) {
        return `${expr.value}`;
    }
    return expr.$type;
}

function checkDocumentValid(document: LangiumDocument): string | undefined {
    return document.parseResult.parserErrors.length && s`
        Parser errors:
          ${document.parseResult.parserErrors.map(e => e.message).join('\n  ')}
    `
        || document.parseResult.value === undefined && `ParseResult is 'undefined'.`
        || !isExpression(document.parseResult.value) && `Root AST object is a ${document.parseResult.value.$type}, expected an 'Expression'.`
        || undefined;
}