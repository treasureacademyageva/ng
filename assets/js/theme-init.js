/* Select the saved or operating-system theme before CSS paints the page. */
try {
  const saved = localStorage.getItem("treasure_theme");
  document.documentElement.dataset.theme = saved ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
} catch (e) {
  document.documentElement.dataset.theme = "light";
}
