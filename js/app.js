// 診断画面と結果画面の小さな動き（選択・タグ・アコーディオン）
document.addEventListener("DOMContentLoaded", () => {
  // 選択式：1つだけ選べる
  document.querySelectorAll(".options").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".option");
      if (!btn) return;
      group.querySelectorAll(".option").forEach((o) => o.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
    });
  });

  // 悩みタグ：複数選択可
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!on));
    });
  });

  // アコーディオン
  document.querySelectorAll(".acc-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      btn.nextElementSibling.hidden = open;
    });
  });
});
