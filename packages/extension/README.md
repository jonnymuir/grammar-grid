# Grammar Grid

**Grammar Grid** is an interactive calculation environment that brings spreadsheet-style simplicity to structured programming. 

[![Open in vscode.dev](https://img.shields.io/static/v1?logo=visualstudiocode&label=vscode.dev&message=Open%20in%20Browser&color=blue)](https://vscode.dev/github/jonnymuir/grammar-grid)

## Features

- **Monaco-Powered Formula Bar**: Get full IntelliSense, syntax highlighting, and validation for your formulas.
- **Strict Grammar Validation**: Powered by Langium, ensuring your calculation logic is always syntactically correct.
- **Custom Grid UI**: A high-performance grid designed for complex engineering and financial calculations.
- **Data Dictionary Integration**: Reference organizational data directly within your logic.

## How to Use

1. Create or open a file with the `.calc` extension.
2. The **Grammar Grid Editor** should open automatically. 
3. (Optional) Right-click a `.calc` file and select **Open With...** -> **GrammarGrid Editor**.
4. Click on a row to edit its formula in the top bar.

## Custom Language Support

The `calculation-language` supports:
- Standard arithmetic: `(10 + 5) * 2`
- Nested functions: `SUM(1, SUM(2, 3))`
- Database keys: `data_dictionary(key_name)`

---
For more information or to contribute, visit the [GitHub Repository](https://github.com/jonnymuir/grammar-grid).