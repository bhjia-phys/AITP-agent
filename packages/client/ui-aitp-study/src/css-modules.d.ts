/** CSS Modules emit a deterministic class-name map in the browser bundle. */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
