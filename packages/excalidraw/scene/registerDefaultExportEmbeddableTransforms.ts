import { registerExportEmbeddableTransform } from "./exportEmbeddableTransforms";
import { replaceCodeBlockEmbeddablesForExport } from "./codeBlock";
import { replaceMathFormulaEmbeddablesForExport } from "./mathFormula";

registerExportEmbeddableTransform(replaceMathFormulaEmbeddablesForExport);
registerExportEmbeddableTransform(replaceCodeBlockEmbeddablesForExport);
