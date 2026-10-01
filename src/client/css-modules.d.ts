/** CSS Modules are compiled by the external plugin's browser bundle. */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
