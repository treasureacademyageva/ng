/* Mark enhanced mode before CSS paints, then select the saved/system theme. */
document.documentElement.classList.add("js");
try {
  const saved = localStorage.getItem("treasure_theme");
  document.documentElement.dataset.theme = saved ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
} catch (e) {
  document.documentElement.dataset.theme = "light";
}
