grammar CalculationLanguage

entry Expression:
    Addition;

// Handles + and -
Addition infers Expression:
    Multiplication ({infer BinaryExpression.left=current} operator=('+' | '-') right=Multiplication)*;

// Handles * and /
Multiplication infers Expression:
    PrimaryExpression ({infer BinaryExpression.left=current} operator=('*' | '/') right=PrimaryExpression)*;

// The core components of a formula
PrimaryExpression infers Expression:
    '(' Expression ')' |
    NumberLiteral |
    FunctionCall |
    CellReference |
    DataDictionaryCall;

// Rule for SUM(val, val, ...)
FunctionCall:
    functionName='SUM' '(' arguments+=Expression (',' arguments+=Expression)* ')';

// Rule for data_dictionary(key)
DataDictionaryCall:
    'data_dictionary' '(' key=ID ')';

// Matches A1, B22, etc.
CellReference:
    ref=ID; 

NumberLiteral:
    value=NUMBER;

terminal ID: /[a-zA-Z_]\w*/;
terminal NUMBER: /\d+(\.\d+)?/;

hidden terminal WS: /\s+/;