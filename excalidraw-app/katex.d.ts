declare module "katex" {
  export type KatexOptions = {
    displayMode?: boolean;
    output?: "html" | "mathml" | "htmlAndMathml";
    throwOnError?: boolean;
    strict?: "ignore" | boolean | string;
  };

  const katex: {
    renderToString: (expression: string, options?: KatexOptions) => string;
  };

  export default katex;
}
