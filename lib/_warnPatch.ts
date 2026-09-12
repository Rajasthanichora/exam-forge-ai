// ? Must be imported FIRST — patches console.warn before any RN module triggers the warning
// Suppresses: "setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture"
const __origWarn = console.warn;
console.warn = (...args) => {
  if (
    args.length > 0 &&
    typeof args[0] === "string" &&
    args[0].includes("setLayoutAnimationEnabledExperimental")
  )
    return;
  __origWarn.apply(console, args);
};
