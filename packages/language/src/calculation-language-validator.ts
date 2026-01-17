import { ValidationAcceptor, ValidationChecks } from 'langium';
import { CalculationLanguageAstType, DataDictionaryCall, FunctionCall } from './generated/ast.js';
import type { CalculationLanguageServices } from './calculation-language-module.js';

export function registerValidationChecks(services: CalculationLanguageServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.CalculationLanguageValidator;
    const checks: ValidationChecks<CalculationLanguageAstType> = {
        DataDictionaryCall: validator.checkDataDictionaryKey,
        FunctionCall: validator.checkFunctionArguments
    };
    registry.register(checks, validator);
}

export class CalculationLanguageValidator {
    // Ensure data_dictionary only uses allowed keys
    checkDataDictionaryKey(node: DataDictionaryCall, accept: ValidationAcceptor): void {
        const allowedKeys = ['final_salary', 'pension_contribution', 'base_pay'];
        if (!allowedKeys.includes(node.key)) {
            accept('error', `Invalid field: '${node.key}'. Valid options are: ${allowedKeys.join(', ')}`, { node, property: 'key' });
        }
    }

    // Ensure SUM has at least one argument
    checkFunctionArguments(node: FunctionCall, accept: ValidationAcceptor): void {
        if (node.arguments.length === 0) {
            accept('error', 'Function SUM requires at least one argument.', { node, property: 'functionName' });
        }
    }
}