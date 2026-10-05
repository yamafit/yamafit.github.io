// 完成時に、ここだけ書き換えれば運営者情報などに反映されます。
const SITE = {
  url: "",          // 例: "https://example.com"（空のままなら「準備中」と表示）
  contactEmail: "", // 例: "info@example.com"（空のままなら表示しない）
  formUrl: "",      // お問い合わせフォームの送信先（Googleフォームの送信先URLなど。空ならテスト表示）
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-site=url]").forEach((el) => {
    if (SITE.url) { el.innerHTML = ""; const a = document.createElement("a"); a.href = SITE.url; a.textContent = SITE.url; el.appendChild(a); }
  });
  document.querySelectorAll("[data-site=email-row]").forEach((row) => {
    if (!SITE.contactEmail) return;
    row.hidden = false;
    row.querySelector("dd").textContent = SITE.contactEmail;
  });
  const form = document.getElementById("contact-form");
  if (form && SITE.formUrl) form.setAttribute("action", SITE.formUrl);
});
