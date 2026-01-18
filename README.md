# GrammarGrid

[![Publish Extension](https://github.com/jonnymuir/grammar-grid/actions/workflows/publish.yml/badge.svg)](https://github.com/jonnymuir/grammar-grid/actions/workflows/publish.yml)
[![Open in vscode.dev](https://img.shields.io/static/v1?logo=visualstudiocode&label=vscode.dev&message=Open%20in%20Browser&color=blue)](https://vscode.dev/github/jonnymuir/grammar-grid)

**GrammarGrid** is a hybrid development environment that combines the intuitive interface of a **spreadsheet** with the power of a **Domain-Specific Language (DSL)**. It allows users to build complex calculation logic using a custom BNF grammar while maintaining a live connection to organizational data dictionaries.

## The Vision

Modern financial and engineering calculations are often trapped in "Black Box" spreadsheets. GrammarGrid solves this by:

1. **Making Logic Auditable:** Formulas are parsed against a strict BNF grammar (Langium).
2. **Providing IDE Features:** The "Formula Bar" is a full Monaco Editor with syntax highlighting, IntelliSense, and type-checking.
3. **Connecting Data Silos:** Custom functions like `data_dictionary()` pull live values directly from SQL databases/APIs instead of hardcoded numbers.

---

## Grammar Grid Demo

[![](https://img.shields.io/badge/Open%20in-vscode.dev-blue)](https://vscode.dev/github/jonnymuir/grammar-grid)

Click the button above to try the Grammar Grid live in your browser! 
No installation required.

## Project Architecture

This project is managed as a **TypeScript Monorepo**:

| Package | Purpose | Core Technologies |
| --- | --- | --- |
| **`packages/language`** | The "Brain." Contains the BNF grammar, parser, and validation logic. | Langium, TypeScript |
| **`packages/extension`** | The "UI." A VS Code extension that hosts the custom Grid and Monaco Formula Bar. | VS Code API, Monaco Editor |

---

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or higher)
* [VS Code](https://code.visualstudio.com/)

### Installation & Build

1. **Clone the repo**
2. **Install dependencies:**
```bash
npm install

```


3. **Generate the Grammar:**
```bash
npm run langium:generate

```


4. **Build the project:**
```bash
npm run build

```



### Running the Extension

1. Open this project in VS Code.
2. Press **F5** (Launch Extension).
3. In the new [Extension Development Host] window, press `Cmd+Shift+P` and run:
> **GrammarGrid: Open Editor**



---

## Custom Language Features

Our custom language (`calculation-language`) currently supports:

* **Nested Functions:** `SUM(10, SUM(5, 2))`
* **Data Lookups:** `data_dictionary(final_salary)`
* **Cell References:** Arithmetic using standard A1, B2 coordinates.
* **Real-time Validation:** Instant red-squiggles for mismatched brackets or invalid database keys.

---

## Roadmap

* [x] Custom Virtual Grid UI
* [x] Monaco Editor Formula Bar integration
* [x] BNF Grammar for nested calculations
* [ ] Live SQL Database connection for Data Dictionary
* [ ] CSV Export/Import for calculated results
* [ ] Dependency Graph (re-calculating B1 when A1 changes)

---